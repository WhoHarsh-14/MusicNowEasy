import { NextRequest, NextResponse } from "next/server";
import { downloadSong, checkYtdlp } from "@/lib/downloader";
import { SongRecommendation } from "@/lib/gemini";
import { PassThrough } from "stream";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

// This project uses a custom `archiver` package that exports named classes
// (ZipArchive, TarArchive, etc.) — NOT the standard archiver npm package.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ZipArchive } = require("archiver") as { ZipArchive: new (opts?: { zlib?: { level?: number } }) => {
  pipe(dest: PassThrough): void;
  file(filePath: string, opts: { name: string }): void;
  finalize(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  destroy(err?: Error): void;
}};

export const maxDuration = 300; // 5 min Vercel cap

// ── Concurrency semaphore ─────────────────────────────────────────────────────
class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.permits > 0) { this.permits--; resolve(); }
      else this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) { next(); }
    else { this.permits++; }
  }
}

/** Adaptive concurrency — scales with playlist size, hard-capped to protect host */
function adaptiveConcurrency(n: number): number {
  if (n <= 5)  return 3;
  if (n <= 15) return 4;
  if (n <= 30) return 5;
  return 6;
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim().substring(0, 80);
}

/** Bridge a Node.js PassThrough into a Web ReadableStream */
function toWebStream(nodeStream: PassThrough): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end",  ()              => controller.close());
      nodeStream.on("error", (err: Error)   => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Pre-flight: ensure yt-dlp is available before starting the stream
  const { ytdlp } = await checkYtdlp();
  if (!ytdlp) {
    return NextResponse.json(
      { error: "yt-dlp binary not available. Check deployment logs." },
      { status: 503 }
    );
  }

  let body: { songs: SongRecommendation[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { songs } = body;
  if (!songs || !Array.isArray(songs) || songs.length === 0) {
    return NextResponse.json({ error: "No songs provided." }, { status: 400 });
  }

  const tempDir = path.join(os.tmpdir(), `mne-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  // ── Streaming ZIP setup ───────────────────────────────────────────────────
  // level: 0 = store mode (no compression).
  // Audio files (M4A, WebM) are already compressed — applying zlib wastes CPU
  // and barely shrinks the file. Store mode is 5-10× faster for ZIP creation.
  const archive   = new ZipArchive({ zlib: { level: 0 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  const webStream = toWebStream(passthrough);

  // ── Background processing (runs concurrently with the HTTP stream) ────────
  const concurrency = adaptiveConcurrency(songs.length);
  const semaphore   = new Semaphore(concurrency);

  const processSongs = async () => {
    const tasks = songs.map(async (song) => {
      await semaphore.acquire();
      try {
        const result = await downloadSong(
          song.searchQuery,
          `${song.title} - ${song.artist}`,
          tempDir
        );
        if (result.success && result.filePath && fs.existsSync(result.filePath)) {
          const ext     = result.fileExt ?? ".m4a";
          const zipName = `${sanitize(song.title)} - ${sanitize(song.artist)}${ext}`;
          archive.file(result.filePath, { name: zipName });
        }
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(tasks);
    await archive.finalize();

    // Deferred cleanup — give the stream time to finish flushing
    setTimeout(() => {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }, 10_000);
  };

  // Fire-and-forget — the stream stays open until archive.finalize() closes it
  processSongs().catch((err) => {
    console.error("[download] Processing error:", err);
    archive.destroy(err as Error);
  });

  const zipFilename = `MusicNowEasy-${songs.length}-songs.zip`;

  return new NextResponse(webStream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "Transfer-Encoding": "chunked",
      "X-Song-Count": songs.length.toString(),
      "Cache-Control": "no-store",
    },
  });
}
