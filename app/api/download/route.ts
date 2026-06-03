import { NextRequest, NextResponse } from "next/server";
import { searchYouTubeVideoId } from "@/lib/youtube";
import { downloadSong, checkYtdlp } from "@/lib/downloader";
import { createMp3Zip, sanitizeFileName } from "@/lib/zipper";
import { SongRecommendation } from "@/lib/gemini";
import fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 300; // 5 minutes max for Vercel

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    // Check prerequisites
    const { ytdlp, ffmpeg } = await checkYtdlp();
    if (!ytdlp) {
      return NextResponse.json(
        {
          error:
            "yt-dlp is not installed. Please run: winget install yt-dlp.yt-dlp",
        },
        { status: 503 }
      );
    }
    if (!ffmpeg) {
      return NextResponse.json(
        {
          error:
            "ffmpeg is not installed. Please run: winget install Gyan.FFmpeg",
        },
        { status: 503 }
      );
    }

    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        {
          error:
            "YOUTUBE_API_KEY not configured. Please add it to your .env.local file.",
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { songs }: { songs: SongRecommendation[] } = body;

    if (!songs || !Array.isArray(songs) || songs.length === 0) {
      return NextResponse.json(
        { error: "No songs provided for download" },
        { status: 400 }
      );
    }

    // Create temp directory
    tempDir = path.join(os.tmpdir(), `musicnoweasy-${uuidv4()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const downloadResults = [];
    const errors: string[] = [];

    // Process songs sequentially to avoid overwhelming the system
    for (const song of songs) {
      try {
        // 1. Find video ID on YouTube
        const ytResult = await searchYouTubeVideoId(song.searchQuery);
        if (!ytResult) {
          errors.push(`Could not find "${song.title}" on YouTube`);
          continue;
        }

        // 2. Download the audio
        const result = await downloadSong(
          ytResult.videoId,
          `${song.title} - ${song.artist}`,
          tempDir
        );

        if (result.success && result.filePath) {
          downloadResults.push({
            filePath: result.filePath,
            zipName: sanitizeFileName(`${song.title} - ${song.artist}.mp3`),
          });
        } else {
          errors.push(
            `Failed to download "${song.title}": ${result.error}`
          );
        }
      } catch (err: unknown) {
        const e = err as Error;
        errors.push(`Error processing "${song.title}": ${e.message}`);
      }
    }

    if (downloadResults.length === 0) {
      return NextResponse.json(
        {
          error: `All downloads failed. Errors: ${errors.join("; ")}`,
        },
        { status: 500 }
      );
    }

    // 3. Create ZIP
    const zipBuffer = await createMp3Zip(downloadResults);

    // 4. Cleanup temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    } catch {
      // Non-critical cleanup failure
    }

    // 5. Stream ZIP to client
    const successCount = downloadResults.length;
    const zipName = `MusicNowEasy-${successCount}-songs.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        "Content-Length": zipBuffer.length.toString(),
        "X-Songs-Downloaded": successCount.toString(),
        "X-Songs-Failed": errors.length.toString(),
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Download API error:", err);

    // Cleanup on error
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    return NextResponse.json(
      { error: err.message || "Download failed" },
      { status: 500 }
    );
  }
}
