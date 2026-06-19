import { NextRequest } from 'next/server';
import scdl from 'soundcloud-downloader';

export const runtime = 'nodejs';

// This route resolves a SoundCloud permalink to a direct CDN URL.
// It returns a 302 redirect — the browser fetches audio DIRECTLY from
// SoundCloud's CDN (cf-media.sndcdn.com, which has CORS: *).
// Vercel serves only this tiny redirect response — zero audio bytes touch Vercel.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  try {
    const info = await scdl.getInfo(url);

    // Only pick progressive MP3 streams where snipped === false (full song, not 30s preview)
    const mp3 = info.media?.transcodings?.find(
      (t: any) => t.format?.protocol === 'progressive' && t.snipped === false
    );
    if (!mp3) return new Response('No full-length MP3 available for this track', { status: 404 });

    const clientId = await scdl.getClientID();
    const streamRes = await fetch(`${mp3.url}?client_id=${clientId}`);
    if (!streamRes.ok) return new Response('SoundCloud stream resolve failed', { status: 502 });

    const { url: cdnUrl } = await streamRes.json();
    if (!cdnUrl) return new Response('No CDN URL returned', { status: 404 });

    // 302 redirect → browser follows → audio flows CDN → Browser directly
    return Response.redirect(cdnUrl, 302);
  } catch (e: any) {
    console.error('Audio resolve error:', e);
    return new Response('Failed to resolve audio', { status: 500 });
  }
}
