import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const results: Record<string, string> = {
    groq: process.env.GROQ_API_KEY ? `SET ✅` : 'MISSING ❌',
    cobalt_url: process.env.COBALT_URL || 'MISSING ❌',
  };

  // Test Prisma/DB connection
  try {
    const { db } = await import('@/lib/db');
    await db.$queryRaw`SELECT 1`;
    results.database = 'Connected ✅';
  } catch (e: any) {
    results.database = `FAILED ❌: ${e.message}`;
  }

  // Test Groq API
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }
    });
    results.groq_api = res.ok ? 'Reachable ✅' : `HTTP ${res.status} ❌`;
  } catch (e: any) {
    results.groq_api = `FAILED ❌: ${e.message}`;
  }

  // Test Cobalt
  try {
    const res = await fetch(process.env.COBALT_URL + '/');
    results.cobalt = res.ok ? 'Reachable ✅' : `HTTP ${res.status} ❌`;
  } catch (e: any) {
    results.cobalt = `FAILED ❌: ${e.message}`;
  }

  return NextResponse.json(results);
}
