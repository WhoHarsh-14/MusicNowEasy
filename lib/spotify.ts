/**
 * Spotify Helper using `spotify-url-info`.
 * 
 * We replaced the Playwright-based headless browser token capture mechanism
 * with the standard `spotify-url-info` extraction to avoid bot-detection
 * blocks and Vercel build failures.
 */

const spotifyUrlInfo = require('spotify-url-info');

const spotifyEmbed = spotifyUrlInfo(fetch);

export async function getSpotifyPlaylist(playlistId: string): Promise<any[]> {
  try {
    const data = await spotifyEmbed.getData(`https://open.spotify.com/playlist/${playlistId}`);
    return data?.trackList ?? [];
  } catch (err: any) {
    console.error('[SpotifyHelper] getSpotifyPlaylist failed:', err.message);
    return [];
  }
}

export async function getSpotifyAlbum(albumId: string): Promise<any[]> {
  try {
    const data = await spotifyEmbed.getData(`https://open.spotify.com/album/${albumId}`);
    return data?.trackList ?? [];
  } catch (err) {
    console.error('getSpotifyAlbum error:', err);
    return [];
  }
}

export async function getSpotifyTrack(trackId: string): Promise<any | null> {
  try {
    const data = await spotifyEmbed.getData(`https://open.spotify.com/track/${trackId}`);
    return data ?? null;
  } catch (err) {
    console.error('getSpotifyTrack error:', err);
    return null;
  }
}

// ── Legacy exports (kept for backward compat) ─────────────────────────────────
export async function spotifySearch(song: any): Promise<any | null> { return null; }
export async function spotifyGenericSearch(query: string, limit: number = 10): Promise<any[]> { return []; }
