/**
 * Spotify playlist extractor.
 * 
 * Strategy:
 * We bypass the official Web API and the 100-track limit by using Spotify's internal GraphQL API ("pathfinder").
 * To authenticate anonymously, we fetch a short-lived token from a public Embed widget URL,
 * which is fully authorized to query the pathfinder endpoint for public playlists.
 * We then paginate through the playlist tracks using the `offset` parameter until we have them all.
 */

import type { RawSong } from './detector';

let anonymousToken: string | null = null;
let anonymousTokenExpiresAt = 0;

/**
 * Fetches an anonymous access token from a Spotify Embed page.
 * This token allows us to query the pathfinder GraphQL API without user authentication.
 */
async function getAnonymousToken(): Promise<string> {
  if (anonymousToken && Date.now() < anonymousTokenExpiresAt) {
    return anonymousToken;
  }

  // We fetch a generic track embed page to harvest its token
  const embedUrl = 'https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC';
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify embed page: HTTP ${res.status}`);
  }

  const html = await res.text();
  
  // The token is embedded within the __NEXT_DATA__ JSON script or directly in a script tag.
  // Using a regex is the most resilient way to extract it without relying on exact JSON paths.
  const match = html.match(/"accessToken":"([^"]+)"/);
  const expiryMatch = html.match(/"accessTokenExpirationTimestampMs":(\d+)/);

  if (!match || !match[1]) {
    throw new Error('Could not extract anonymous access token from Spotify embed page.');
  }

  anonymousToken = match[1];
  anonymousTokenExpiresAt = expiryMatch && expiryMatch[1] ? parseInt(expiryMatch[1], 10) : Date.now() + 3000 * 1000;
  
  return anonymousToken;
}

export async function extractSpotifyPlaylist(url: string): Promise<RawSong[]> {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  if (!match) throw new Error('Invalid Spotify playlist URL');
  const playlistId = match[1];

  console.log(`[Spotify GraphQL] Extracting playlist ${playlistId} using pathfinder...`);
  
  const token = await getAnonymousToken();
  const allTracks: RawSong[] = [];
  
  let offset = 0;
  const limit = 100;
  let totalCount = 0;
  
  // The exact sha256 hash Spotify uses for the fetchPlaylist GraphQL operation
  const queryHash = "a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4";

  while (true) {
    const variables = {
      uri: `spotify:playlist:${playlistId}`,
      offset,
      limit,
      enableWatchFeedEntrypoint: false
    };

    const params = new URLSearchParams({
      operationName: "fetchPlaylist",
      variables: JSON.stringify(variables),
      extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: queryHash } })
    });

    const gqlUrl = `https://api-partner.spotify.com/pathfinder/v1/query?${params.toString()}`;
    
    const res = await fetch(gqlUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'app-platform': 'WebPlayer',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        // Token might have expired early, force a refresh on next call
        anonymousToken = null; 
      }
      const err = await res.text();
      throw new Error(`Spotify GraphQL error: HTTP ${res.status} - ${err}`);
    }

    const json = await res.json();
    
    // Check if Spotify returned any GraphQL errors
    if (json.errors && json.errors.length > 0) {
      throw new Error(`Spotify GraphQL returned errors: ${json.errors[0].message}`);
    }

    const playlistV2 = json?.data?.playlistV2;
    if (!playlistV2) {
      throw new Error('Playlist data is missing or private.');
    }

    const content = playlistV2.content;
    const items = content?.items || [];
    
    if (offset === 0) {
      totalCount = content?.totalCount || items.length;
      console.log(`[Spotify GraphQL] Discovered ${totalCount} total tracks in playlist.`);
    }

    for (const edge of items) {
      const itemData = edge?.itemV2?.data;
      if (!itemData || itemData.__typename !== 'Track' || !itemData.name) {
        continue;
      }

      const title = itemData.name;
      const artist = itemData.artists?.items?.[0]?.profile?.name || 'Unknown Artist';
      const albumArt = itemData.albumOfTrack?.coverArt?.sources?.[0]?.url || '';
      const durationMs = itemData.trackDuration?.totalMilliseconds || 0;
      const popularity = parseInt(itemData.playcount || '0', 10) || 0;

      allTracks.push({
        title,
        artist,
        albumArt,
        durationMs,
        popularity,
        previewUrl: null // GraphQL doesn't typically provide audioPreview
      });
    }

    offset += limit;
    
    if (offset >= totalCount || items.length === 0) {
      break; // Reached the end
    }
    
    console.log(`[Spotify GraphQL] Fetched ${allTracks.length} / ${totalCount} tracks. Paginating...`);
  }

  if (allTracks.length === 0) {
    throw new Error('Playlist is empty or tracks are unavailable.');
  }

  console.log(`[Spotify GraphQL] Successfully extracted all ${allTracks.length} tracks.`);
  return allTracks;
}
