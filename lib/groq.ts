import { RawSong } from '@/types';

// Groq Free Tier limits: 30 RPM, 14,400 RPD
// We can safely process 3 batches simultaneously.
export const MAX_CONCURRENT = 3;

const SYSTEM_PROMPT = `You are an expert DJ and music curator with deep knowledge of Bollywood, Punjabi, Regional Indian music, and International genres.

CRITICAL RULES:
1. Return ONLY a valid JSON array. No markdown, no backticks, no explanation.
2. Every song MUST be real and findable on YouTube.
3. Accurate artist names — spelled exactly as they appear on Spotify.
4. Include variety. Never repeat a song.`;

export function buildPrompt(query: string, count: number, exclude: string[] = []): string {
  const excludeClause = exclude.length > 0
    ? `\n\nDO NOT include any of these songs (already selected): ${exclude.slice(0, 50).join('; ')}`
    : '';

  return `User request: "${query}"${excludeClause}

Return exactly ${count} songs as a JSON array with ONLY title and artist:
[
  { "title": "Song Title", "artist": "Artist Name" }
]`;
}

// Function now properly named since we use Groq (Llama 3) under the hood!
export async function collectGroqSongs(
  query: string,
  count: number,
  exclude: string[] = []
): Promise<RawSong[]> {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is missing! Please paste your key into .env.local');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile', // Smarter, fast, completely free Llama 3.3 model
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildPrompt(query, count, exclude) }
      ],
      temperature: 0.9,
    })
  });

  if (!response.ok) {
     const text = await response.text();
     console.error('Groq API error:', text);
     throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices[0].message.content;

  // Extract the JSON array from the response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const songs = JSON.parse(match[0]) as RawSong[];
    return songs.filter(s => s.title && s.artist);
  } catch {
    return [];
  }
}
