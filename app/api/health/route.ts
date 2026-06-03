import { NextResponse } from "next/server";
import { checkYtdlp } from "@/lib/downloader";

export async function GET() {
  const { ytdlp, ffmpeg } = await checkYtdlp();

  return NextResponse.json({
    gemini: !!process.env.GEMINI_API_KEY,
    youtube: !!process.env.YOUTUBE_API_KEY,
    ytdlp,
    ffmpeg,
  });
}
