import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import os from "os";

const execFileAsync = promisify(execFile);

// Common locations winget installs CLI tools on Windows
const WINGET_LINKS = path.join(
  os.homedir(),
  "AppData",
  "Local",
  "Microsoft",
  "WinGet",
  "Links"
);

const PROGRAM_FILES_LINKS = [
  path.join("C:", "Program Files", "yt-dlp"),
  path.join("C:", "Program Files (x86)", "yt-dlp"),
];

/** Find the actual path of a binary, checking PATH then winget fallbacks */
async function resolveBinary(name: string): Promise<string | null> {
  // 1. Try directly (relies on PATH)
  try {
    await execFileAsync(name, ["--version"], { timeout: 5000 });
    return name;
  } catch {
    // not on PATH yet
  }

  // 2. Check winget links directory (where winget puts CLI aliases)
  const candidates = [
    path.join(WINGET_LINKS, `${name}.exe`),
    path.join(WINGET_LINKS, name),
    ...PROGRAM_FILES_LINKS.map((p) => path.join(p, `${name}.exe`)),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        await execFileAsync(candidate, ["--version"], { timeout: 5000 });
        return candidate;
      } catch {
        // binary exists but can't run
      }
    }
  }

  // 3. Try where.exe (Windows) to locate the binary
  try {
    const { stdout } = await execFileAsync("where.exe", [name], {
      timeout: 5000,
    });
    const resolved = stdout.trim().split("\n")[0].trim();
    if (resolved) return resolved;
  } catch {
    // where.exe also failed
  }

  return null;
}

export interface DownloadResult {
  success: boolean;
  filePath?: string;
  error?: string;
  title: string;
}

export async function downloadSong(
  videoId: string,
  songTitle: string,
  outputDir: string
): Promise<DownloadResult> {
  const ytdlpPath = await resolveBinary("yt-dlp");
  if (!ytdlpPath) {
    return {
      success: false,
      error: "yt-dlp not found. Run: winget install yt-dlp.yt-dlp",
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
    await execFileAsync(
      ytdlpPath,
      [
        url,
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "-o", outputTemplate,
        "--no-playlist",
        "--embed-thumbnail",
        "--add-metadata",
        "--no-warnings",
        "--quiet",
      ],
      { timeout: 120000 }
    );

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
  const [ytdlpPath, ffmpegPath] = await Promise.all([
    resolveBinary("yt-dlp"),
    resolveBinary("ffmpeg"),
  ]);
  return { ytdlp: !!ytdlpPath, ffmpeg: !!ffmpegPath };
}
