/**
 * Platform detector — parses a playlist URL and identifies the source platform.
 * Routes to the correct extractor.
 */

export type Platform =
  | 'spotify'
  | 'youtube'
  | 'youtube-music'
  | 'apple-music'
  | 'unknown';

export type RawSong = {
  title: string;
  artist: string;
  albumArt?: string;
  durationMs?: number;
  popularity?: number;
  previewUrl?: string | null;
  youtubeVideoId?: string; // Only set for YouTube playlists — skips search step
};

export function detectPlatform(url: string): Platform {
  try {
    const { hostname, searchParams, pathname } = new URL(url);

    if (hostname.includes('spotify.com')) {
      if (pathname.includes('/playlist/')) return 'spotify';
      if (pathname.includes('/album/'))
        throw new Error('Spotify album URLs are not supported — paste a playlist URL instead.');
      if (pathname.includes('/track/'))
        throw new Error('This is a Spotify track, not a playlist — paste a playlist URL.');
      throw new Error('Only Spotify playlist URLs are supported.');
    }

    if (hostname.includes('music.youtube.com')) {
      if (searchParams.has('list')) return 'youtube-music';
      throw new Error('Only YouTube Music playlist URLs are supported (must contain ?list=).');
    }

    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      if (searchParams.has('list')) return 'youtube';
      throw new Error('Only YouTube playlist URLs are supported (must contain ?list=).');
    }

    if (hostname.includes('music.apple.com')) return 'apple-music';

    return 'unknown';
  } catch (e: any) {
    // Re-throw our custom messages, wrap URL parse errors
    if (e.message && !e.message.startsWith('Invalid URL')) throw e;
    throw new Error('Invalid URL — please paste a full playlist URL including https://');
  }
}
