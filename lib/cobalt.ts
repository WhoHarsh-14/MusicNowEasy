import YouTube from 'youtube-sr';


export async function cobaltResolve(song: {
  title: string;
  artist: string;
}): Promise<string | null> {
    let videoUrl = '';
    
    try {
      // Search YouTube and grab the first 5 results
      const results = await YouTube.search(
        `${song.title} ${song.artist} official audio`,
        { limit: 5, type: 'video' }
      );

      // Filter out long videos (over 8 minutes) to avoid 1-hour loops/compilations
      const originalVideo = results.find(r => r.duration < 8 * 60 * 1000);
      if (originalVideo?.url) {
        videoUrl = originalVideo.url;
      }
    } catch (e) {
      console.warn(`[cobaltResolve] youtube-sr failed for "${song.title}", using raw fallback...`);
      // Fallback: Raw fetch to YouTube and regex the first videoId
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song.title + ' ' + song.artist + ' official audio')}`;
      const searchRes = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
      });
      const html = await searchRes.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match && match[1]) {
        videoUrl = `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }

    if (!videoUrl) return null;

    // Return a stable /api/stream URL (not a Cobalt tunnel URL).
    // This points directly to the new Next.js yt-dlp local proxy!
    return `/api/stream?url=${encodeURIComponent(videoUrl)}`;
}
