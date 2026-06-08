import path from "path";
import fs from "fs";
import https from "https";
import ffmpegPath from "ffmpeg-static";
import { create as createYoutubeDl } from "yt-dlp-exec";

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileExt?: string;
  error?: string;
  title: string;
}

// ── Binary helpers ────────────────────────────────────────────────────────────

function fetchBinary(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const follow = (target: string) => {
      https
        .get(target, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            file.close();
            return follow(res.headers.location!);
          }
          if (res.statusCode !== 200) {
            file.close();
            fs.unlink(dest, () => {});
            return reject(new Error(`HTTP ${res.statusCode} downloading binary`));
          }
          res.pipe(file);
          file.on("finish", () => { file.close(); resolve(); });
        })
        .on("error", (err) => { file.close(); fs.unlink(dest, () => {}); reject(err); });
    };
    follow(url);
  });
}

let ytdlpDownloadPromise: Promise<void> | null = null;

async function ensureYtdlpLinux(dest: string): Promise<void> {
  if (fs.existsSync(dest)) return;

  if (!ytdlpDownloadPromise) {
    ytdlpDownloadPromise = (async () => {
      console.log("[yt-dlp] Downloading standalone Linux binary…");
      const tmp = `${dest}.tmp`;
      try {
        await fetchBinary(
          "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux",
          tmp
        );
        fs.renameSync(tmp, dest);
        fs.chmodSync(dest, 0o755);
        console.log("[yt-dlp] Binary ready.");
      } catch (err) {
        ytdlpDownloadPromise = null;
        if (fs.existsSync(tmp)) try { fs.unlinkSync(tmp); } catch {}
        throw err;
      }
    })();
  }
  return ytdlpDownloadPromise;
}

async function getExecutablePaths(): Promise<{
  ytdlpPath: string;
  ffmpegBin: string;
  ffmpegDir: string;
}> {
  const isWin = process.platform === "win32";
  let ytdlpBin = path.join(
    process.cwd(), "node_modules", "yt-dlp-exec", "bin",
    isWin ? "yt-dlp.exe" : "yt-dlp"
  );
  let ffmpegBin = ffmpegPath || "";

  if (process.platform === "linux") {
    const tmpFfmpeg = "/tmp/ffmpeg";
    const tmpYtdlp  = "/tmp/yt-dlp";

    // ffmpeg — copy from static package
    if (!fs.existsSync(tmpFfmpeg) && ffmpegBin && fs.existsSync(ffmpegBin)) {
      try { fs.copyFileSync(ffmpegBin, tmpFfmpeg); fs.chmodSync(tmpFfmpeg, 0o755); } catch {}
    }
    if (fs.existsSync(tmpFfmpeg)) ffmpegBin = tmpFfmpeg;

    // yt-dlp — download standalone binary (no Python dependency)
    try {
      await ensureYtdlpLinux(tmpYtdlp);
      ytdlpBin = tmpYtdlp;
    } catch {
      // fallback: copy zipapp binary and hope Python is available
      if (!fs.existsSync(tmpYtdlp) && fs.existsSync(ytdlpBin)) {
        try { fs.copyFileSync(ytdlpBin, tmpYtdlp); fs.chmodSync(tmpYtdlp, 0o755); } catch {}
      }
      if (fs.existsSync(tmpYtdlp)) ytdlpBin = tmpYtdlp;
    }
  }

  return { ytdlpPath: ytdlpBin, ffmpegBin, ffmpegDir: path.dirname(ffmpegBin) };
}

// ── Audio extensions we'll accept ────────────────────────────────────────────
const AUDIO_EXTS = [".m4a", ".aac", ".webm", ".opus", ".mp3", ".ogg"];

// ── Main download function ────────────────────────────────────────────────────
/**
 * Downloads audio for `searchQuery` using yt-dlp's built-in search
 * (ytsearch1:), removing the YouTube Data API dependency.
 * Prefers M4A / AAC (no re-encoding) for maximum speed.
 */
export async function downloadSong(
  searchQuery: string,
  songTitle: string,
  outputDir: string,
  timeoutMs = 55_000
): Promise<DownloadResult> {
  const { ytdlpPath, ffmpegBin, ffmpegDir } = await getExecutablePaths();

  if (!ytdlpPath || !fs.existsSync(ytdlpPath)) {
    return { success: false, error: "yt-dlp binary not found.", title: songTitle };
  }

  // Sanitise for filesystem
  const safeTitle = songTitle
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 70);

  // Per-song sub-directory avoids filename collisions under concurrency
  const songDir = path.join(outputDir, safeTitle);
  fs.mkdirSync(songDir, { recursive: true });
  const outputTemplate = path.join(songDir, "audio.%(ext)s");

  try {
    const youtubedl = createYoutubeDl(ytdlpPath);

    // Race the download against a hard timeout
    await Promise.race([
      youtubedl(`ytsearch1:${searchQuery}`, {
        // Download best native M4A/AAC directly — no ffmpeg transcode needed.
        // Falls back to webm/opus (also container-copy, no transcode).
        format: "bestaudio[ext=m4a]/bestaudio[ext=aac]/bestaudio",
        output: outputTemplate,
        noPlaylist: true,
        noWarnings: true,
        quiet: true,
        ...(ffmpegBin && fs.existsSync(ffmpegBin) ? { ffmpegLocation: ffmpegDir } : {}),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timed out after ${timeoutMs / 1000}s`)), timeoutMs)
      ),
    ]);

    // Locate the downloaded file
    const files = fs.readdirSync(songDir);
    const audioFile = files.find((f) =>
      AUDIO_EXTS.some((ext) => f.toLowerCase().endsWith(ext))
    );

    if (audioFile) {
      return {
        success: true,
        filePath: path.join(songDir, audioFile),
        fileExt: path.extname(audioFile),
        title: songTitle,
      };
    }

    return { success: false, error: "No audio file found after download.", title: songTitle };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "Unknown download error",
      title: songTitle,
    };
  }
}

// ── Health check ─────────────────────────────────────────────────────────────
let cachedHealth: { ytdlp: boolean; ffmpeg: boolean } | null = null;

export async function checkYtdlp(): Promise<{ ytdlp: boolean; ffmpeg: boolean }> {
  if (cachedHealth?.ytdlp && cachedHealth?.ffmpeg) return cachedHealth;

  try {
    const { ytdlpPath, ffmpegBin } = await getExecutablePaths();
    const ffmpegOk = typeof ffmpegBin === "string" && fs.existsSync(ffmpegBin);

    let ytdlpOk = false;
    try {
      const ydl = createYoutubeDl(ytdlpPath);
      await ydl("", { version: true });
      ytdlpOk = true;
    } catch (e) {
      console.warn("[health] yt-dlp version check failed:", (e as Error).message);
    }

    const result = { ytdlp: ytdlpOk, ffmpeg: ffmpegOk };
    if (result.ytdlp && result.ffmpeg) cachedHealth = result;
    return result;
  } catch {
    return { ytdlp: false, ffmpeg: false };
  }
}
