import path from "path";
import fs from "fs";
import os from "os";
import ffmpegPath from "ffmpeg-static";
import { create as createYoutubeDl } from "yt-dlp-exec";

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  title: string;
}

async function getExecutablePaths(): Promise<{
  ytdlpPath: string;
  ffmpegPath: string;
  ffmpegDir: string;
}> {
  let ffmpegBin = ffmpegPath || "";
  let ytdlpBin = "";

  const isWin = process.platform === "win32";

  ytdlpBin = path.join(
    process.cwd(),
    "node_modules",
    "yt-dlp-exec",
    "bin",
    isWin ? "yt-dlp.exe" : "yt-dlp"
  );

  // On Linux (e.g. Vercel), copy binaries to /tmp and chmod to executable
  if (process.platform === "linux") {
    const tmpFfmpegPath = path.join("/tmp", "ffmpeg");
    const tmpYtdlpPath = path.join("/tmp", "yt-dlp");

    // Copy ffmpeg if not exists in /tmp
    if (!fs.existsSync(tmpFfmpegPath) && ffmpegBin && fs.existsSync(ffmpegBin)) {
      try {
        fs.copyFileSync(ffmpegBin, tmpFfmpegPath);
        fs.chmodSync(tmpFfmpegPath, 0o755);
      } catch (err) {
        console.error("Failed to copy/chmod ffmpeg to /tmp:", err);
      }
    }
    if (fs.existsSync(tmpFfmpegPath)) {
      ffmpegBin = tmpFfmpegPath;
    }

    // Copy yt-dlp if not exists in /tmp
    if (!fs.existsSync(tmpYtdlpPath) && ytdlpBin && fs.existsSync(ytdlpBin)) {
      try {
        fs.copyFileSync(ytdlpBin, tmpYtdlpPath);
        fs.chmodSync(tmpYtdlpPath, 0o755);
      } catch (err) {
        console.error("Failed to copy/chmod yt-dlp to /tmp:", err);
      }
    }
    if (fs.existsSync(tmpYtdlpPath)) {
      ytdlpBin = tmpYtdlpPath;
    }
  }

  return {
    ytdlpPath: ytdlpBin,
    ffmpegPath: ffmpegBin,
    ffmpegDir: path.dirname(ffmpegBin),
  };
}

export async function downloadSong(
  videoId: string,
  songTitle: string,
  outputDir: string
): Promise<DownloadResult> {
  const { ytdlpPath, ffmpegPath: resolvedFfmpegPath, ffmpegDir } = await getExecutablePaths();

  if (!resolvedFfmpegPath || !fs.existsSync(resolvedFfmpegPath)) {
    return {
      success: false,
      error: "ffmpeg binary path is not available.",
      title: songTitle,
    };
  }

  if (!ytdlpPath || !fs.existsSync(ytdlpPath)) {
    return {
      success: false,
      error: "yt-dlp binary path is not available.",
      title: songTitle,
    };
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;
  // Sanitize title for filename
  const safeTitle = songTitle
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 100);

  const outputTemplate = path.join(outputDir, `${safeTitle}.%(ext)s`);
  const expectedMp3 = path.join(outputDir, `${safeTitle}.mp3`);

  try {
    const youtubedl = createYoutubeDl(ytdlpPath);
    await youtubedl(url, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: 0,
      output: outputTemplate,
      noPlaylist: true,
      embedThumbnail: true,
      addMetadata: true,
      noWarnings: true,
      quiet: true,
      ffmpegLocation: ffmpegDir,
    });

    if (fs.existsSync(expectedMp3)) {
      return { success: true, filePath: expectedMp3, title: songTitle };
    }

    // Search for any mp3 with a similar name
    const files = fs.readdirSync(outputDir);
    const mp3File = files.find(
      (f) => f.endsWith(".mp3") && f.includes(safeTitle.substring(0, 10))
    );
    if (mp3File) {
      return {
        success: true,
        filePath: path.join(outputDir, mp3File),
        title: songTitle,
      };
    }

    return {
      success: false,
      error: "MP3 file not found after download",
      title: songTitle,
    };
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      error: err.message || "Unknown download error",
      title: songTitle,
    };
  }
}

export async function checkYtdlp(): Promise<{
  ytdlp: boolean;
  ffmpeg: boolean;
}> {
  try {
    const { ytdlpPath, ffmpegPath: resolvedFfmpegPath } = await getExecutablePaths();

    // 1. Check if ffmpeg-static path exists
    const ffmpegExists = typeof resolvedFfmpegPath === "string" && fs.existsSync(resolvedFfmpegPath);

    // 2. Check if yt-dlp-exec is functional by executing version check
    let ytdlpExists = false;
    try {
      const youtubedl = createYoutubeDl(ytdlpPath);
      await youtubedl("", { version: true });
      ytdlpExists = true;
    } catch (err) {
      console.error("Health check: yt-dlp-exec version check failed:", err);
    }

    return {
      ytdlp: ytdlpExists,
      ffmpeg: ffmpegExists,
    };
  } catch (err) {
    console.error("Health check failed:", err);
    return {
      ytdlp: false,
      ffmpeg: false,
    };
  }
}
