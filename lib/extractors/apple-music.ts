/**
 * Apple Music extractor — scrapes JSON-LD structured data from Apple Music playlist pages.
 * No API key required. Works for public curated playlists.
 * Note: May break if Apple changes their HTML structure.
 */

import type { RawSong } from './detector';

export async function extractAppleMusicPlaylist(url: string): Promise<RawSong[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Apple Music returned HTTP ${res.status}. Is this playlist public?`);
  }

  const html = await res.text();

  // Apple Music embeds playlist data as JSON-LD in the page
  const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];

  for (const match of jsonLdMatches) {
    try {
      const jsonLd = JSON.parse(match[1]);

      // Apple Music JSON-LD: can be MusicPlaylist directly or wrapped in @graph
      const playlist =
        jsonLd?.['@type'] === 'MusicPlaylist'
          ? jsonLd
          : jsonLd?.['@graph']?.find((g: any) => g['@type'] === 'MusicPlaylist');

      if (!playlist) continue;

      const tracks: any[] = playlist.track ?? [];
      if (tracks.length === 0) continue;

      return tracks.map((track: any) => ({
        title: track.name ?? 'Unknown',
        artist: track.byArtist?.name ?? '',
        albumArt: typeof track.image === 'string' ? track.image : (track.image?.[0] ?? ''),
        durationMs: 0,
        popularity: 0,
        previewUrl: null,
      }));
    } catch {
      // Try next JSON-LD block
    }
  }

  // Fallback: try to find track data in the embedded server data
  const serverDataMatch = html.match(/window\.__SERVER_DATA__\s*=\s*({[\s\S]+?});\s*<\/script>/);
  if (serverDataMatch) {
    try {
      const serverData = JSON.parse(serverDataMatch[1]);
      const songs =
        serverData?.albumDetail?.data?.attributes?.trackList ||
        serverData?.playlistDetail?.data?.attributes?.trackList ||
        [];
      if (songs.length > 0) {
        return songs.map((s: any) => ({
          title: s.title ?? s.name ?? 'Unknown',
          artist: s.artistName ?? s.artist ?? '',
          albumArt: s.artwork?.url?.replace('{w}', '300').replace('{h}', '300') ?? '',
          durationMs: (s.durationInMillis ?? 0),
          popularity: 0,
          previewUrl: null,
        }));
      }
    } catch {
      // Ignore
    }
  }

  throw new Error(
    'Could not parse Apple Music playlist. Try a different playlist or check if it is public.'
  );
}
