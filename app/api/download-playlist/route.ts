/**
 * GET /api/download-playlist?url=...
 *
 * SSE endpoint. Detects platform, extracts all songs, resolves each to
 * an /api/stream URL via cobalt in parallel batches of 20, and pushes
 * each resolved song to the browser the moment it's ready.
 *
 * Supported platforms: Spotify, YouTube, YouTube Music, Apple Music
 * SoundCloud: skipped (no stable client ID)
 * YouTube Data API: skipped (no API key) — YouTube playlists use direct video ID resolution
 */

import { NextRequest } from 'next/server';
import { detectPlatform, type RawSong } from '@/lib/extractors/detector';
import { extractSpotifyPlaylist } from '@/lib/extractors/spotify';
import { extractAppleMusicPlaylist } from '@/lib/extractors/apple-music';
import { cobaltResolve, cobaltResolveYouTubeId } from '@/lib/cobalt';
import { db } from '@/lib/db';
import type { Song } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Cobalt batch size — 20 parallel resolves at once
const COBALT_BATCH = 20;

// Cache TTL per platform (ms)
const CACHE_TTL: Record<string, number> = {
  spotify: 6 * 60 * 60 * 1000,        // 6 hours
  youtube: 6 * 60 * 60 * 1000,        // 6 hours
  'youtube-music': 6 * 60 * 60 * 1000,
  'apple-music': 24 * 60 * 60 * 1000, // 24 hours (daily chart updates)
};

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url') ?? '';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      try {
        if (!urlParam.trim()) {
          send({ type: 'error', message: 'No URL provided.' });
          return;
        }

        // ── Step 1: Detect platform ───────────────────────────────────────────
        const platform = detectPlatform(urlParam);
        if (platform === 'unknown') {
          send({ type: 'error', message: 'Platform not supported. Supported: Spotify, YouTube, Apple Music.' });
          return;
        }

        // ── Step 2: Check Supabase cache ─────────────────────────────────────
        const ttl = CACHE_TTL[platform] ?? 6 * 60 * 60 * 1000;
        try {
          const cached = await db.playlistCache.findFirst({
            where: {
              sourceUrl: urlParam,
              createdAt: { gte: new Date(Date.now() - ttl) },
            },
            orderBy: { createdAt: 'desc' },
          });

          if (cached) {
            const cachedSongs = cached.songsJson as Song[];
            send({ type: 'meta', total: cachedSongs.length, platform, fromCache: true });
            for (const song of cachedSongs) {
              send({ type: 'song', song });
            }
            send({ type: 'done' });
            return;
          }
        } catch (dbErr) {
          // Non-fatal — cache miss, proceed with live fetch
          console.warn('[download-playlist] Cache lookup failed:', dbErr);
        }

        // ── Step 3: Extract raw songs from platform ───────────────────────────
        send({ type: 'status', message: 'Fetching playlist...' });
        let rawSongs: RawSong[] = [];

        if (platform === 'spotify') {
          rawSongs = await extractSpotifyPlaylist(urlParam);
        } else if (platform === 'youtube' || platform === 'youtube-music') {
          // No YouTube Data API key — extract video IDs from the playlist page HTML
          rawSongs = await extractYouTubePlaylistFallback(urlParam);
        } else if (platform === 'apple-music') {
          rawSongs = await extractAppleMusicPlaylist(urlParam);
        }

        if (rawSongs.length === 0) {
          send({ type: 'error', message: 'No songs found in this playlist. Is it public?' });
          return;
        }

        // Deduplicate by title+artist to save Cobalt API calls
        const seen = new Set<string>();
        rawSongs = rawSongs.filter(s => {
          const key = `${s.title}__${s.artist}`.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        send({ type: 'meta', total: rawSongs.length, platform, fromCache: false });

        // ── Step 4: Resolve audio URLs in parallel batches ────────────────────
        const resolvedSongs: Song[] = [];

        for (let i = 0; i < rawSongs.length; i += COBALT_BATCH) {
          if (req.signal.aborted) break;

          const batch = rawSongs.slice(i, i + COBALT_BATCH);

          const batchResults = await Promise.allSettled(
            batch.map(async (raw) => {
              // YouTube playlists: use direct video ID (no search, ~0ms overhead)
              // All other platforms: use youtube-sr search
              const audioUrl = raw.youtubeVideoId
                ? await cobaltResolveYouTubeId(raw.youtubeVideoId)
                : await cobaltResolve({ title: raw.title, artist: raw.artist });

              const song: Song = {
                id: crypto.randomUUID(),
                title: raw.title,
                artist: raw.artist,
                albumArt: raw.albumArt ?? '',
                durationMs: raw.durationMs ?? 0,
                popularity: raw.popularity ?? 0,
                previewUrl: raw.previewUrl ?? null,
                audioUrl: audioUrl ?? '', // Empty = unavailable; UI shows badge
              };

              // Push to browser immediately — don't wait for full batch
              send({ type: 'song', song });
              return song;
            })
          );

          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              resolvedSongs.push(result.value);
            }
          }
        }

        send({ type: 'done' });

        // ── Step 5: Write to Supabase cache (non-blocking) ────────────────────
        if (resolvedSongs.length > 0) {
          db.playlistCache.create({
            data: {
              sourceUrl: urlParam,
              platform,
              songCount: resolvedSongs.length,
              songsJson: resolvedSongs as any,
            },
          }).catch(err => console.warn('[download-playlist] Cache write failed:', err));
        }

      } catch (err: any) {
        console.error('[download-playlist] Error:', err);
        send({ type: 'error', message: err.message ?? 'Failed to process playlist. Please try again.' });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Fallback YouTube playlist extractor — no API key required.
 * Fetches the YouTube playlist page HTML and extracts video IDs + titles
 * using ytInitialData embedded in the page.
 */
async function extractYouTubePlaylistFallback(url: string): Promise<RawSong[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`YouTube returned HTTP ${res.status}. Is this playlist public?`);
  }

  const html = await res.text();

  // YouTube embeds ytInitialData as a JSON blob in the page
  const match = html.match(/var ytInitialData\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (!match) {
    throw new Error('Could not parse YouTube playlist. Try a public playlist URL.');
  }

  let ytData: any;
  try {
    ytData = JSON.parse(match[1]);
  } catch {
    throw new Error('Could not parse YouTube playlist data.');
  }

  // Navigate through the deeply nested YouTube data structure
  const contents =
    ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]
      ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents?.[0]
      ?.playlistVideoListRenderer?.contents ?? [];

  const songs: RawSong[] = [];

  for (const item of contents) {
    const video = item?.playlistVideoRenderer;
    if (!video) continue;

    const title = video.title?.runs?.[0]?.text ?? video.title?.simpleText ?? 'Unknown';
    if (title === 'Deleted video' || title === 'Private video') continue;

    const videoId = video.videoId;
    const artist = video.shortBylineText?.runs?.[0]?.text ?? '';
    const thumbnailUrl = video.thumbnail?.thumbnails?.slice(-1)[0]?.url ?? '';
    const durationMs = parseDuration(video.lengthText?.simpleText ?? '');

    songs.push({
      title,
      artist,
      albumArt: thumbnailUrl,
      durationMs,
      popularity: 0,
      previewUrl: null,
      youtubeVideoId: videoId, // ← key: skip search step entirely
    });
  }

  if (songs.length === 0) {
    throw new Error('No videos found in this YouTube playlist. Is it public and does it have videos?');
  }

  return songs;
}

function parseDuration(text: string): number {
  // Parses "3:45" or "1:03:45" → milliseconds
  const parts = text.split(':').map(Number);
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}
