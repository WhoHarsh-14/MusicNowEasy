export async function prewarm(): Promise<void> {
  try {
    await Promise.allSettled([
      // Warm Spotify token cache
      fetch('/api/spotify-token'),
    ]);
  } catch (e) {
    console.error("Prewarm failed", e);
  }
}
