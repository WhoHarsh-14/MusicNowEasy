import { NextResponse } from 'next/server';
import { getSpotifyToken } from '@/lib/spotify';

export async function GET() {
  try {
    const token = await getSpotifyToken();
    // Don't return the token to the client, just confirm it's cached on the server
    return NextResponse.json({ status: 'ok', prewarmed: !!token });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message }, { status: 500 });
  }
}
