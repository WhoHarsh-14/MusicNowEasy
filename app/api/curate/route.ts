import { NextRequest } from 'next/server';
import { collectGeminiSongs, MAX_CONCURRENT } from '@/lib/gemini';
import { spotifySearch, getSpotifyToken } from '@/lib/spotify';
import { cobaltResolve } from '@/lib/cobalt';
import { db } from '@/lib/db';
import { CurateStage, Song, RawSong } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 10;

// Simple semaphore — limits concurrent Gemini calls to MAX_CONCURRENT
function createSemaphore(max: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async function<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= max) await new Promise<void>(resolve => queue.push(resolve));
    running++;
    try {
      return await fn();
    } finally {
      running--;
      queue.shift()?.();
    }
  };
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? '';
  const count = Math.min(parseInt(req.nextUrl.searchParams.get('n') ?? '20'), 200);

  if (!query.trim()) {
    return new Response('Missing query', { status: 400 });
  }

  const encoder = new TextEncoder();

  // Check cache first
  try {
    const cached = await db.queryHistory.findFirst({
      where: { query: query.toLowerCase().trim() },
      orderBy: { createdAt: 'desc' },
    });
    if (cached && isRecent(cached.createdAt, 24) && cached.songCount >= count) {
      const songs = (cached.songsJson as unknown as Song[]).slice(0, count);
      const stream = replayAsSSE(songs, encoder);
      return new Response(stream, { headers: sseHeaders });
    }
  } catch (e) {
    console.error('Cache read failed:', e);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CurateStage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      const resolvedSongs: Song[] = [];
      const seenKeys = new Set<string>();

      const enrichAndSend = async (rawSong: RawSong, token: string) => {
        if (req.signal.aborted) return;

        // Deduplicate by normalised title+artist
        const key = `${rawSong.title.toLowerCase().trim()}|${rawSong.artist.toLowerCase().trim()}`;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        const [spotifyTrack, audioUrl] = await Promise.all([
          token ? spotifySearch(rawSong, token).catch(() => null) : null,
          cobaltResolve(rawSong).catch(() => null),
        ]);

        if (!audioUrl) return; // Skip if Cobalt couldn't resolve

        const song: Song = {
          id: spotifyTrack?.id ?? crypto.randomUUID(),
          title: spotifyTrack?.name ?? rawSong.title,
          artist: spotifyTrack?.artists[0]?.name ?? rawSong.artist,
          albumArt: spotifyTrack?.album.images[0]?.url ?? '',
          durationMs: spotifyTrack?.duration_ms ?? 0,
          popularity: spotifyTrack?.popularity ?? 0,
          previewUrl: spotifyTrack?.preview_url ?? null,
          audioUrl, // Points to Cobalt tunnel — browser fetches directly
        };

        resolvedSongs.push(song);
        send({ type: 'song', song });
      };

      try {
        const token = await getSpotifyToken().catch(() => '');
        const geminiSlot = createSemaphore(MAX_CONCURRENT);

        // ─── Phase A: Parallel Gemini batches (rate-limited) ─────────────────
        // Batches fire in groups of MAX_CONCURRENT (3) to stay within 15 RPM.
        // Wall time ≈ ceil(numBatches / 3) × ~5s   e.g. 10 batches → ~20s
        const numBatches = Math.ceil(count / BATCH_SIZE);
        const batchPromises = Array.from({ length: numBatches }, () =>
          geminiSlot(() => collectGeminiSongs(query, BATCH_SIZE))
        );

        // As each batch resolves, immediately enrich + SSE emit its songs
        await Promise.all(
          batchPromises.map(async (batchPromise) => {
            const rawSongs = await batchPromise;
            await Promise.all(rawSongs.map((song) => enrichAndSend(song, token)));
          })
        );

        // ─── Phase B: Fill-up pass ────────────────────────────────────────────
        // If deduplication reduced the count, request exact missing amount
        const missing = count - resolvedSongs.length;
        if (missing > 0 && !req.signal.aborted) {
          const excludeList = resolvedSongs.map((s) => `${s.title} by ${s.artist}`);
          const fillSongs = await collectGeminiSongs(query, missing, excludeList);
          await Promise.all(fillSongs.map((song) => enrichAndSend(song, token)));
        }

        send({ type: 'done' });

        // Cache in background (non-blocking)
        if (resolvedSongs.length > 0) {
          db.queryHistory.create({
            data: {
              query: query.toLowerCase().trim(),
              songCount: resolvedSongs.length,
              songsJson: resolvedSongs as any,
            },
          }).catch(console.error);
        }
      } catch (err: any) {
        console.error(err);
        send({ type: 'error', message: err.message || 'Something went wrong. Please try again.' });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}

const sseHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
};

function isRecent(date: Date, hours: number): boolean {
  return Date.now() - date.getTime() < hours * 60 * 60 * 1000;
}

function replayAsSSE(songs: Song[], encoder: TextEncoder): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      for (const song of songs) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'song', song })}\n\n`)
        );
        await new Promise((r) => setTimeout(r, 10));
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      controller.close();
    },
  });
}
