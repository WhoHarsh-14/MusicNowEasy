/**
 * Resolves a song to an /api/stream URL using yt-dlp's native ytsearch: feature.
 *
 * Previously used youtube-sr for search then passed the video URL to yt-dlp.
 * However, youtube-sr hangs due to YouTube bot-detection in server environments.
 *
 * yt-dlp natively supports `ytsearch:` prefix queries, so we build the search
 * query directly and hand it off. yt-dlp's search is more robust and runs locally.
 */
export async function cobaltResolve(song: {
  title: string;
  artist: string;
}): Promise<string | null> {
  // Sanitize the title and artist to remove quotes, brackets, and special characters.
  // This prevents Windows spawn argument parsing issues and stops YouTube from treating
  // quotes as strict exact-match operators, which causes 0-result failures.
  const cleanTitle = song.title.replace(/["'()[\]{}<>]/g, '').trim();
  const cleanArtist = song.artist.replace(/["'()[\]{}<>]/g, '').trim();
  
  const query = `${cleanTitle} ${cleanArtist} official audio`;
  const searchUrl = `ytsearch1:${query}`;
  return `/api/stream?url=${encodeURIComponent(searchUrl)}`;
}

/**
 * Resolves a YouTube video directly by video ID — no search needed.
 * Used for YouTube playlists where we already have the exact video ID.
 * ~100ms faster per track vs cobaltResolve (no youtube-sr search round-trip).
 */
export async function cobaltResolveYouTubeId(videoId: string): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return `/api/stream?url=${encodeURIComponent(videoUrl)}`;
}
