import { NextRequest } from 'next/server';
import { getSpotifyToken, spotifyGenericSearch } from '@/lib/spotify';
import { cobaltResolve } from '@/lib/cobalt';
import { CurateStage, Song } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') ?? '';

  if (!query.trim()) {
    return new Response('Missing query', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: CurateStage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        const token = await getSpotifyToken().catch(() => '');
        if (!token) {
          send({ type: 'error', message: 'Spotify auth failed' });
          controller.close();
          return;
        }

        // 1. Get exact tracks from Spotify
        const spotifyTracks = await spotifyGenericSearch(query, token, 15);
        
        if (spotifyTracks.length === 0) {
          send({ type: 'error', message: `No tracks found for "${query}"` });
          controller.close();
          return;
        }

        // 2. Resolve audio via Cobalt in parallel
        await Promise.all(
          spotifyTracks.map(async (track) => {
            if (req.signal.aborted) return;
            
            // Build a RawSong representation to pass to Cobalt
            const rawSong = {
              title: track.name,
              artist: track.artists[0]?.name ?? 'Unknown',
            };

            const audioUrl = await cobaltResolve(rawSong).catch(() => null);

            // Even if Cobalt fails to resolve it (e.g. not on YouTube), we skip it to ensure playability.
            if (!audioUrl) return;

            const song: Song = {
              id: track.id,
              title: track.name,
              artist: track.artists[0]?.name ?? 'Unknown',
              albumArt: track.album.images[0]?.url ?? '',
              durationMs: track.duration_ms,
              popularity: track.popularity,
              previewUrl: track.preview_url,
              audioUrl,
            };

            send({ type: 'song', song });
          })
        );

        send({ type: 'done' });
      } catch (e: any) {
        console.error('Search API error:', e);
        send({ type: 'error', message: e.message || 'Failed to search' });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
