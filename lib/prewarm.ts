export async function prewarm(): Promise<void> {
  try {
    await Promise.allSettled([]);
  } catch (e) {
    console.error("Prewarm failed", e);
  }
}
