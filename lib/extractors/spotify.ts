/**
 * Spotify playlist extractor.
 * 
 * Strategy:
 * Instead of using heavy and brittle headless browsers (which get blocked by Spotify WAF),
 * we fetch the public Spotify Embed widget HTML (`/embed/playlist/...`).
 * The embed HTML contains a `__NEXT_DATA__` JSON blob with up to 100 tracks,
 * which is more than enough for most use cases, and it completely bypasses 
 * API rate limits, bot blocks, and token requirements.
 */

import type { RawSong } from './detector';

let spotifyAccessToken: string | null = null;
let spotifyTokenExpiresAt = 0;

async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials');
  }

  if (spotifyAccessToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyAccessToken;
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch Spotify access token');
  }

  const data = await res.json();
  spotifyAccessToken = data.access_token;
  spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyAccessToken!;
}

export async function extractSpotifyPlaylist(url: string): Promise<RawSong[]> {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL');
  const playlistId = match[1];

  // If we have API keys, use the robust official Web API to bypass the 100-track limit
  if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    try {
      console.log(`[Spotify] Fetching playlist ${playlistId} via official API...`);
      const token = await getSpotifyToken();
      
      const allTracks: RawSong[] = [];
      let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
      
      while (nextUrl) {
        const res = await fetch(nextUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Spotify API error: HTTP ${res.status} - ${errText}`);
        }
        
        const data = await res.json();
        const items = data.items || [];
        
        for (const item of items) {
          const track = item.track;
          if (!track || !track.name) continue;
          
          allTracks.push({
            title: track.name,
            artist: track.artists?.[0]?.name || 'Unknown Artist',
            albumArt: track.album?.images?.[0]?.url || '',
            durationMs: track.duration_ms || 0,
            popularity: track.popularity || 0,
            previewUrl: track.preview_url || null,
          });
        }
        
        nextUrl = data.next || null;
      }
      
      console.log(`[Spotify] Extracted ${allTracks.length} tracks from official API.`);
      if (allTracks.length > 0) return allTracks;
    } catch (err: any) {
      console.warn('[Spotify] Official API failed, falling back to embed extraction:', err);
    }
  }

  console.log(`[Spotify] Fetching embed widget for playlist ${playlistId}...`);
  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator`;

  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify embed page: HTTP ${res.status}`);
  }

  const html = await res.text();
  const startStr = 'id="__NEXT_DATA__" type="application/json">';
  const startIndex = html.indexOf(startStr);
  
  if (startIndex === -1) {
    throw new Error('Could not find playlist data in Spotify response. The playlist might be private.');
  }

  const jsonStart = startIndex + startStr.length;
  const endIndex = html.indexOf('</script>', jsonStart);
  const jsonStr = html.substring(jsonStart, endIndex);

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('Failed to parse Spotify playlist data');
  }

  const entity = data?.props?.pageProps?.state?.data?.entity;
  if (!entity || !entity.trackList) {
    throw new Error('No tracklist found in Spotify data. It may be private or invalid.');
  }

  // Use playlist cover art as fallback for tracks that don't specify their own
  const playlistCover = entity.coverArt?.sources?.[0]?.url || '';
  
  const allTracks: RawSong[] = [];
  const items = entity.trackList;

  console.log(`[Spotify] Extracted ${items.length} tracks from embed data.`);

  for (const track of items) {
    if (!track.title) continue;
    
    // Subtitle is usually the artist name in the embed format
    const artist = track.subtitle || 'Unknown Artist';
    
    // Tracks in embed usually don't have individual coverArt, so we fallback to playlist cover
    const albumArt = track.coverArt?.sources?.[0]?.url || playlistCover;

    allTracks.push({
      title: track.title,
      artist: artist,
      albumArt: albumArt,
      durationMs: track.duration || 0,
      popularity: 0,
      previewUrl: track.audioPreview?.url || null,
    });
  }

  if (allTracks.length === 0) {
    throw new Error('Playlist is empty or tracks are unavailable.');
  }

  return allTracks;
}
