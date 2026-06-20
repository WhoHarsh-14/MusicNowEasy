import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
export const maxDuration = 60; // Max allowed for Vercel Hobby

// Simple in-memory cache to make timeline seeking INSTANT
// Maps youtube URL -> { directUrl, expiresAt }
const urlCache = new Map<string, { directUrl: string, expiresAt: number }>();

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const now = Date.now();
    const cached = urlCache.get(url);
    if (cached && cached.expiresAt > now) {
      return Response.redirect(cached.directUrl, 302);
    }

    const ytdlpPath = process.env.YTDLP_PATH || '.\\yt-dlp.exe';
    
    // Execute yt-dlp to extract the direct Googlevideo streaming URL
    // --js-runtimes node is required for decrypting signatures
    const { stdout } = await execFileAsync(ytdlpPath, [
      '-g',
      '-f', 'bestaudio[ext=webm]',
      '--js-runtimes', 'node',
      url
    ]);

    const directUrl = stdout.trim();

    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error('Failed to extract direct URL');
    }

    // Cache the URL for 2 hours (Google Video URLs expire after ~6 hours)
    urlCache.set(url, { directUrl, expiresAt: now + 2 * 60 * 60 * 1000 });

    // Redirect the browser/client to the direct Google Video URL
    // This allows the browser to natively handle HTTP Range requests for flawless seeking!
    return Response.redirect(directUrl, 302);
  } catch (err: unknown) {
    console.error('[stream error]', err);
    return new Response(JSON.stringify({ error: 'Stream failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
