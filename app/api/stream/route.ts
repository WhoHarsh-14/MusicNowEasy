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
    const useProxy = req.nextUrl.searchParams.get('proxy') === 'true';
    const useResolve = req.nextUrl.searchParams.get('resolve') === 'true';

    const cached = urlCache.get(url);
    if (cached && cached.expiresAt > now) {
      if (useResolve) {
        return new Response(JSON.stringify({ url: cached.directUrl }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      if (useProxy) {
        const proxyRes = await fetch(cached.directUrl);
        if (!proxyRes.ok) throw new Error('Proxy failed');
        return new Response(proxyRes.body as any, {
          headers: {
            'Content-Type': proxyRes.headers.get('Content-Type') || 'audio/webm',
            'Content-Length': proxyRes.headers.get('Content-Length') || '',
            'Access-Control-Allow-Origin': '*',
          }
        });
      }
      return Response.redirect(cached.directUrl, 302);
    }

    const ytdlpPath = process.env.YTDLP_PATH || '.\\yt-dlp.exe';
    
    // Execute yt-dlp to extract the direct Googlevideo streaming URL
    // --js-runtimes node is required for decrypting signatures
    const { stdout } = await execFileAsync(ytdlpPath, [
      '--no-playlist',
      '-g',
      '-f', 'bestaudio[ext=webm]/bestaudio',
      '--js-runtimes', 'node',
      url
    ], { timeout: 15000 });

    const directUrl = stdout.trim();

    if (!directUrl || !directUrl.startsWith('http')) {
      throw new Error('Failed to extract direct URL');
    }

    // Cache the URL for 2 hours (Google Video URLs expire after ~6 hours)
    urlCache.set(url, { directUrl, expiresAt: now + 2 * 60 * 60 * 1000 });


    if (useResolve) {
      // Return just the direct URL as JSON — lets the browser download
      // directly from Google CDN at full speed (no server bottleneck)
      return new Response(JSON.stringify({ url: directUrl }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (useProxy) {
      // YouTube aggressively throttles generic Node.js fetch() streams to 0.1 MB/s.
      // To bypass this, we use yt-dlp to natively download the stream (which has built-in
      // throttling bypasses) and pipe it directly to the browser.
      const { spawn } = require('child_process');
      const ytdlp = spawn(ytdlpPath, [
        '--no-playlist',
        '-f', 'bestaudio[ext=webm]/bestaudio',
        '--js-runtimes', 'node',
        '-o', '-',
        url
      ]);

      const stream = new ReadableStream({
        start(controller) {
          ytdlp.stdout.on('data', (chunk: Buffer) => controller.enqueue(chunk));
          ytdlp.stdout.on('end', () => controller.close());
          ytdlp.on('error', (err: Error) => controller.error(err));
        },
        cancel() {
          ytdlp.kill();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'audio/webm',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

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
