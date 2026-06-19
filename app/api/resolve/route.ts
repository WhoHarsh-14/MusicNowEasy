import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Resolves a YouTube URL to a fresh Cobalt tunnel URL at request time,
// then issues a 302 redirect so the browser fetches audio directly from Cobalt.
//
// Flow:
//   Browser fetches /api/resolve?url=youtube_url
//   → This route calls self-hosted Cobalt (Railway)
//   → Cobalt returns a fresh tunnel URL
//   → This route returns 302 redirect to that tunnel URL
//   → Browser follows redirect → downloads from Cobalt (Railway)
//   → Audio: YouTube → Cobalt → Browser   (Vercel = only this tiny redirect response)
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  const COBALT_URL = process.env.COBALT_URL;
  console.log('[resolve] COBALT_URL:', COBALT_URL ? COBALT_URL.slice(0, 50) : 'MISSING');
  console.log('[resolve] YouTube URL:', url.slice(0, 60));

  if (!COBALT_URL) return new Response('COBALT_URL not configured', { status: 500 });

  try {
    const cobaltRes = await fetch(COBALT_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        downloadMode: 'audio',
        audioFormat: 'mp3',
      }),
      signal: AbortSignal.timeout(15000),
    });

    console.log('[resolve] Cobalt HTTP status:', cobaltRes.status);

    if (!cobaltRes.ok) {
      const errText = await cobaltRes.text().catch(() => '');
      console.error('[resolve] Cobalt non-ok response:', errText.slice(0, 200));
      return new Response(`Cobalt error: ${cobaltRes.status}`, { status: 502 });
    }

    const data = await cobaltRes.json();
    console.log('[resolve] Cobalt data status:', data.status, 'url:', data.url?.slice(0, 60));

    if (!data.url || !['tunnel', 'redirect', 'stream'].includes(data.status)) {
      console.error('[resolve] Unexpected Cobalt response:', JSON.stringify(data));
      return new Response('No audio URL from Cobalt', { status: 502 });
    }

    // 302 → browser fetches directly from Cobalt tunnel (Railway)
    return Response.redirect(data.url, 302);
  } catch (e: any) {
    console.error('[resolve] Fetch threw:', e.message, e.cause?.message);
    return new Response('Failed to resolve audio', { status: 500 });
  }
}
