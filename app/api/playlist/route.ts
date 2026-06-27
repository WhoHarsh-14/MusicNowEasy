import { NextRequest } from 'next/server';
import { getSpotifyPlaylist, getSpotifyTrack, getSpotifyAlbum } from '@/lib/spotify';
import { cobaltResolve } from '@/lib/cobalt';
import { CurateStage, Song, SpotifyTrack } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s for Vercel Hobby

export async function POST(req: NextRequest) {
  let urlStr = '';

  try {
    const body = await req.json();
    urlStr = body.url || body.link || '';
  } catch (e) {
    return new Response('Invalid JSON body', { status: 400 });
  }

  if (!urlStr.trim()) {
    return new Response('Missing url', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CurateStage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      const resolvedSongs: Song[] = [];

      const enrichAndSend = async (spotifyTrack: any) => {
        if (req.signal.aborted) return;

        // Skip tracks with no title or artist
        if (!spotifyTrack || !spotifyTrack.title) return;

        const rawSong = {
          title: spotifyTrack.title || spotifyTrack.name,
          artist: spotifyTrack.subtitle || spotifyTrack.artists?.[0]?.name || 'Unknown',
        };

        send({ type: 'status', message: `Resolving audio for ${rawSong.title}...` });

        const audioUrl = await cobaltResolve(rawSong).catch(() => null);

        const song: Song = {
          id: spotifyTrack.uri?.split(':').pop() || spotifyTrack.id || crypto.randomUUID(),
          title: rawSong.title,
          artist: rawSong.artist,
          albumArt: spotifyTrack.coverArt?.sources?.[0]?.url || spotifyTrack.album?.images?.[0]?.url || '',
          durationMs: spotifyTrack.duration || spotifyTrack.duration_ms || 0,
          popularity: spotifyTrack.popularity ?? 0,
          previewUrl: spotifyTrack.audioPreview?.url || spotifyTrack.preview_url || null,
          audioUrl: audioUrl || '', // Points to /api/stream or empty if failed
        };

        resolvedSongs.push(song);
        send({ type: 'song', song });
      };

      try {
        
        let tracksToProcess: any[] = [];

        // Parse URL
        if (urlStr.includes('spotify.com/playlist/')) {
          const match = urlStr.match(/playlist\/([a-zA-Z0-9]+)/);
          if (match && match[1]) {
            send({ type: 'status', message: `Fetching Spotify Playlist...` });
            tracksToProcess = await getSpotifyPlaylist(match[1]);
          }
        } else if (urlStr.includes('spotify.com/album/')) {
          const match = urlStr.match(/album\/([a-zA-Z0-9]+)/);
          if (match && match[1]) {
            send({ type: 'status', message: `Fetching Spotify Album...` });
            tracksToProcess = await getSpotifyAlbum(match[1]);
          }
        } else if (urlStr.includes('spotify.com/track/')) {
          const match = urlStr.match(/track\/([a-zA-Z0-9]+)/);
          if (match && match[1]) {
            send({ type: 'status', message: `Fetching Spotify Track...` });
            const track = await getSpotifyTrack(match[1]);
            if (track) tracksToProcess.push(track);
          }
        } else {
          // If it's a YouTube link, we can just resolve it directly via /api/stream
          // But for now we focus on Spotify. Let's just pass it to cobaltResolve directly if it's YouTube?
          // Since the prompt mainly asks for Spotify Playlist/Track URLs.
          throw new Error("Only Spotify Playlist and Track URLs are currently supported.");
        }

        if (tracksToProcess.length === 0) {
          throw new Error("No tracks found or invalid Spotify URL.");
        }

        send({ type: 'status', message: `Found ${tracksToProcess.length} tracks. Resolving audio...` });

        // Process in parallel batches to speed up resolution significantly
        // Concurrency set to 5: Safest limit for youtube-sr without hitting 429
        const MAX_CONCURRENT = 5;
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

        const resolveSlot = createSemaphore(MAX_CONCURRENT);

        // Map all tracks to promise-returning functions wrapped by the semaphore
        const trackPromises = tracksToProcess.map(track =>
          resolveSlot(async () => {
            if (req.signal.aborted) return;
            await enrichAndSend(track);
          })
        );

        // Wait for all batches to finish
        await Promise.all(trackPromises);

        send({ type: 'done' });
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
