import { google } from "googleapis";

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY,
});

export async function searchYouTubeVideoId(
  query: string
): Promise<{ videoId: string; title: string } | null> {
  if (!process.env.YOUTUBE_API_KEY) {
    throw new Error("YOUTUBE_API_KEY is not set in environment variables");
  }

  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      q: query,
      type: ["video"],
      maxResults: 1,
      videoCategoryId: "10", // Music category
    });

    const items = response.data.items;
    if (!items || items.length === 0) return null;

    const item = items[0];
    const videoId = item.id?.videoId;
    const title = item.snippet?.title;

    if (!videoId) return null;

    return { videoId, title: title || query };
  } catch (error) {
    console.error("YouTube search error:", error);
    throw new Error(`YouTube search failed for query: "${query}"`);
  }
}
