import { RawSong, SpotifyTrack } from '@/types';

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  // Return cached token if still valid (they last 1 hour)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Failed to get Spotify token: ' + JSON.stringify(data));
  }
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
  return cachedToken.token;
}

export async function spotifySearch(
  song: RawSong,
  token: string
): Promise<SpotifyTrack | null> {
  // Build search query — title + artist gives best results
  const q = encodeURIComponent(`track:${song.title} artist:${song.artist}`);

  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1&market=IN`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.tracks?.items?.[0] ?? null;
}

export async function spotifyGenericSearch(
  query: string,
  token: string,
  limit: number = 10
): Promise<SpotifyTrack[]> {
  const q = encodeURIComponent(query);
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${q}&type=track&limit=${limit}&market=IN`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.tracks?.items ?? [];
}
