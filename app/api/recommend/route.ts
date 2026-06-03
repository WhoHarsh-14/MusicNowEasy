import { NextRequest, NextResponse } from "next/server";
import { getSongRecommendations } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, count = 5 } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "A prompt is required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Gemini API key not configured. Please add GEMINI_API_KEY to your .env.local file.",
        },
        { status: 503 }
      );
    }

    const clampedCount = Math.min(Math.max(Number(count) || 5, 1), 10);
    const songs = await getSongRecommendations(prompt.trim(), clampedCount);

    return NextResponse.json({ songs });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Recommend API error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to get song recommendations" },
      { status: 500 }
    );
  }
}
