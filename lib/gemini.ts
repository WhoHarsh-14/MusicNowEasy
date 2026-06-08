import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SongRecommendation {
  title: string;
  artist: string;
  searchQuery: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Try models in order — some may have 0 free-tier quota on certain projects
const MODEL_FALLBACKS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-pro",
];

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: Error | null = null;

  for (const modelName of MODEL_FALLBACKS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      lastError = e;

      const msg = e.message || "";
      const is404 = msg.includes("404") || msg.includes("not found");
      const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests");
      const is503 = msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("demand") || msg.includes("overloaded") || msg.includes("temporary");
      const is500 = msg.includes("500") || msg.includes("Internal Error") || msg.includes("Internal Server Error");
      const is502 = msg.includes("502") || msg.includes("Bad Gateway");
      const is504 = msg.includes("504") || msg.includes("Gateway Timeout");

      const isTransient =
        is404 ||
        is429 ||
        is503 ||
        is500 ||
        is502 ||
        is504 ||
        (e.status !== undefined && (e.status === 404 || e.status === 429 || e.status >= 500));

      if (isTransient) {
        // Try next model
        console.warn(
          `Model ${modelName} unavailable (status: ${e.status ?? "unknown"}, error: ${msg}), trying next...`
        );
        continue;
      }

      // Non-quota error — don't retry
      throw e;
    }
  }

  // All models failed
  throw lastError || new Error("All Gemini models are unavailable");
}

export interface QuizAnswers {
  type?: string;
  vibe?: string;
  trend?: string;
  theme?: string;
  base?: string;
}

export async function getSongRecommendations(
  prompt: string,
  count: number = 5,
  quiz?: QuizAnswers
): Promise<SongRecommendation[]> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }

  let refinementText = "";
  if (quiz) {
    const parts = [];
    if (quiz.type) parts.push(`Type of song: ${quiz.type}`);
    if (quiz.vibe) parts.push(`Vibe: ${quiz.vibe}`);
    if (quiz.trend) parts.push(`Trend: ${quiz.trend}`);
    if (quiz.theme) parts.push(`Theme: ${quiz.theme}`);
    if (quiz.base) parts.push(`Base: ${quiz.base}`);

    if (parts.length > 0) {
      refinementText = `\n\nAdditionally, please refine the recommendations to fit these preferences:\n${parts.map(p => `- ${p}`).join("\n")}`;
    }
  }

  const systemPrompt = `You are a music expert. The user wants to discover songs.
Return ONLY a valid JSON array (no markdown, no explanation, no code blocks) with exactly ${count} songs matching the user's request.
Each item must have: "title" (song name), "artist" (artist/band name), "searchQuery" (best YouTube search string to find this exact song, e.g. "Song Title Artist Name official audio").

User's request: ${prompt}${refinementText}

Respond with ONLY the JSON array, example format:
[{"title":"Blinding Lights","artist":"The Weeknd","searchQuery":"Blinding Lights The Weeknd official audio"},{"title":"Levitating","artist":"Dua Lipa","searchQuery":"Levitating Dua Lipa official audio"}]`;

  const responseText = await generateWithFallback(systemPrompt);

  // Strip any markdown code fences if present
  const cleaned = responseText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const songs: SongRecommendation[] = JSON.parse(cleaned);

  if (!Array.isArray(songs)) {
    throw new Error("Gemini returned non-array response");
  }

  return songs.slice(0, count);
}
