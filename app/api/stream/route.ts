import { NextRequest } from 'next/server';
import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const maxDuration = 60; // Max allowed for Vercel Hobby

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const ytdlpPath = process.env.YTDLP_PATH || '.\\yt-dlp.exe';
    // Spawn yt-dlp locally and tell it to output raw audio bytes to stdout
    const ytDlp = spawn(ytdlpPath, [
      '-f', 'bestaudio[ext=webm]', // Extract highest quality WebM audio stream to match Content-Type
      '-o', '-',         // Output binary data directly to standard output
      '--quiet',         // Suppress logs and progress bars
      '--js-runtimes', 'node', // Enable Node.js for JS decryption of video signatures
      url
    ]);

    // Pipe the raw audio binary stream directly into Next.js Response
    const stream = new ReadableStream({
      start(controller) {
        ytDlp.stdout.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        ytDlp.stdout.on('end', () => {
          controller.close();
        });
        ytDlp.on('error', (err) => {
          console.error('yt-dlp process error:', err);
          controller.error(err);
        });
      },
      cancel() {
        ytDlp.kill(); // Stop downloading if the user cancels the ZIP download
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/webm', // Best audio format from YouTube
        'Transfer-Encoding': 'chunked',
        'Access-Control-Allow-Origin': '*', // Bypass any browser CORS issues
      },
    });
  } catch (err: unknown) {
    console.error('[stream error]', err);
    return new Response(JSON.stringify({ error: 'Stream failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
