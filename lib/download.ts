import { Zip, ZipPassThrough } from 'fflate';
import { Song } from '@/types';

export type DownloadProgress = {
  songTitle: string;
  completed: number;
  total: number;
  bytesReceived: number;
  estimatedTotal: number;
  activeSongIds: string[];
  completedSongIds: string[];
  speedMBps: number;
  timeRemainingSec: number;
};

export async function downloadPlaylist(
  songs: Song[],
  playlistName: string,
  onProgress: (p: DownloadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  // Estimate total size from Spotify duration (avg ~1MB/min at 320kbps)
  const estimatedTotal = songs.reduce((acc, s) => acc + (s.durationMs / 60000) * 1024 * 1024, 0);
  const suggestedName = `${playlistName.replace(/[^a-z0-9]/gi, '-')}.zip`;

  let writer: WritableStreamDefaultWriter<any> | null = null;
  let fileStream: WritableStream<any> | null = null;

  try {
    // Try the modern File System Access API first (supported in Chrome/Edge/Opera)
    // This avoids StreamSaver UUID fallback issues and lets the user pick the location
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'ZIP Archive',
          accept: { 'application/zip': ['.zip'] },
        }],
      });
      fileStream = await handle.createWritable();
      writer = fileStream.getWriter();
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
       throw new Error("Download cancelled by user"); // Abort completely if user hits cancel
    }
    console.warn("showSaveFilePicker failed or unsupported, falling back to StreamSaver", err);
  }

  // Fallback to StreamSaver if File System Access API is unavailable
  if (!writer) {
    const streamSaver = (await import('streamsaver')).default;
    fileStream = streamSaver.createWriteStream(suggestedName, { size: estimatedTotal });
    if (window.WritableStream && fileStream.getWriter) {
       writer = fileStream.getWriter();
    } else {
       console.error("Streamsaver fallback not properly supported here, browser doesn't support WritableStream");
       throw new Error("Browser not supported for large downloads.");
    }
  }

  if (signal) {
    signal.addEventListener('abort', () => {
      writer!.abort();
    });
  }

  let bytesReceived = 0;
  let completed = 0;
  const activeSongIds: string[] = [];
  const completedSongIds: string[] = [];
  const startTime = Date.now();
  let lastUpdateTime = Date.now();

  const emitProgress = (title: string) => {
    const now = Date.now();
    const elapsedSec = (now - startTime) / 1000;
    const speedMBps = elapsedSec > 0 ? (bytesReceived / 1024 / 1024) / elapsedSec : 0;

    // ETA based on songs: more accurate than byte estimates when total is unknown
    const avgSecPerSong = completed > 0 ? elapsedSec / completed : 0;
    const timeRemainingSec = avgSecPerSong > 0 ? avgSecPerSong * (songs.length - completed) : 0;

    onProgress({
      songTitle: title,
      completed,
      total: songs.length,
      bytesReceived,
      estimatedTotal: 0,
      activeSongIds: [...activeSongIds],
      completedSongIds: [...completedSongIds],
      speedMBps,
      timeRemainingSec: Math.max(0, timeRemainingSec),
    });
  };


  // ── Phase 1 & 2 combined: Resolve and Download in parallel batches of 10 ─────────
  // We process 5 songs concurrently. For each song, we ask the server to resolve the 
  // yt-dlp direct CDN URL, and then immediately begin streaming it into the ZIP.
  // We use 5 instead of 10 because yt-dlp spawns a Python process and runs Node JS decryption,
  // which causes severe CPU thrashing if too many run simultaneously.
  const BATCH_SIZE = 5;

  // Create streaming ZIP — each chunk written immediately to disk
  const zip = new Zip((err, chunk, final) => {
    if (err) { console.error('ZIP Error', err); return; }
    writer!.write(chunk);
    if (final) writer!.close();
  });

  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    
    const batch = songs.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (song) => {
      if (!song.audioUrl) {
        completed++;
        return;
      }

      const filename = `${song.title} - ${song.artist}.mp3`
        .replace(/[<>:"/\\|?*]/g, '');

      try {
        activeSongIds.push(song.id);

        // The backend /api/stream route has been upgraded to pipe yt-dlp directly.
        // Electron's webSecurity is disabled, allowing us to fetch the direct URL.
        // We MUST use &resolve=true to get the raw URL instead of a redirect.
        let resolveUrl = song.audioUrl;
        if (song.audioUrl.includes('/api/stream')) {
          resolveUrl = `${song.audioUrl}&resolve=true`;
        }

        let directUrl = '';
        let resolveRetries = 5;
        while (resolveRetries > 0) {
          if (signal?.aborted) break;
          try {
            const resolveRes = await fetch(resolveUrl, { signal });
            if (resolveRes.ok) {
              const resolveData = await resolveRes.json();
              directUrl = resolveData.url;
              if (directUrl) break;
            }
          } catch (err) {
            console.warn(`Resolve failed for ${song.title}, retrying...`, err);
          }
          resolveRetries--;
          if (resolveRetries > 0) await new Promise(r => setTimeout(r, 3000));
        }

        if (!directUrl) throw new Error('Failed to extract direct URL after retries');

        let offset = 0;
        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const entry = new ZipPassThrough(filename);
        let firstChunk = true;
        let streamClosed = false;

        try {
          // Loop to download the file in 1MB chunks.
          // YouTube heavily throttles continuous streams to 0.1 MB/s (playback speed).
          // By requesting chunks using the 'Range' header, we bypass the throttle 
          // and download at 10-50 MB/s!
          while (true) {
            if (signal?.aborted) break;

            const end = offset + CHUNK_SIZE - 1;
            let chunkRes: Response | null = null;
            let chunkRetries = 5;
            let success = false;

            while (chunkRetries > 0) {
              if (signal?.aborted) break;
              try {
                chunkRes = await fetch(directUrl, {
                  headers: { 'Range': `bytes=${offset}-${end}` },
                  signal
                });

                if (chunkRes.ok || chunkRes.status === 416) {
                  success = true;
                  break;
                }
              } catch (err) {
                console.warn(`Chunk fetch failed for ${song.title} at offset ${offset}, retrying...`, err);
              }
              chunkRetries--;
              if (chunkRetries > 0) await new Promise(r => setTimeout(r, 2000));
            }

            if (!success || !chunkRes) {
               throw new Error(`Chunk failed completely after 5 retries`);
            }

            // 416 means Range Not Satisfiable (we read past the end of the file)
            if (chunkRes.status === 416) {
               break;
            }

            const buffer = await chunkRes.arrayBuffer();
            const chunkArray = new Uint8Array(buffer);

            if (firstChunk) {
              if (chunkArray.length === 0) {
                throw new Error('Stream empty');
              }
              zip.add(entry);
              firstChunk = false;
            }

            if (chunkArray.length > 0) {
              entry.push(chunkArray);
              bytesReceived += chunkArray.length;
              offset += chunkArray.length;

              const now = Date.now();
              if (now - lastUpdateTime > 80) {
                lastUpdateTime = now;
                emitProgress(song.title);
              }
            }

            // If we received less than we asked for, we've hit the end of the file!
            if (chunkArray.length < CHUNK_SIZE) {
               break;
            }
          }

          if (!firstChunk) {
            entry.push(new Uint8Array(0), true);
            streamClosed = true;
            completed++;
            const idx = activeSongIds.indexOf(song.id);
            if (idx !== -1) activeSongIds.splice(idx, 1);
            completedSongIds.push(song.id);
            emitProgress(song.title);
          } else {
            throw new Error('No data received');
          }
        } catch (err) {
          // If we started writing the file but an error occurred, we MUST close the stream
          // otherwise the fflate ZIP will hang forever waiting for this file to finish!
          if (!firstChunk && !streamClosed) {
            entry.push(new Uint8Array(0), true);
            streamClosed = true;
          }
          throw err; // Re-throw to be caught by outer block
        }
      } catch (err) {
        if (signal?.aborted) {
          console.warn('Download aborted');
        } else {
          console.warn(`Skipped: ${song.title}`, err);
          completed++;
          completedSongIds.push(song.id);
        }
        const idx = activeSongIds.indexOf(song.id);
        if (idx !== -1) activeSongIds.splice(idx, 1);
      }
    }));
  }

  zip.end();
}
