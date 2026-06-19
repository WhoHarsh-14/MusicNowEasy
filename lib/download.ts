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
    
    // Estimate remaining time
    const bytesRemaining = Math.max(0, estimatedTotal - bytesReceived);
    const timeRemainingSec = speedMBps > 0 ? (bytesRemaining / 1024 / 1024) / speedMBps : 0;

    onProgress({
      songTitle: title,
      completed,
      total: songs.length,
      bytesReceived,
      estimatedTotal,
      activeSongIds: [...activeSongIds],
      completedSongIds: [...completedSongIds],
      speedMBps,
      timeRemainingSec: Math.max(0, timeRemainingSec)
    });
  };

  // Create streaming ZIP — each chunk written immediately to disk
  const zip = new Zip((err, chunk, final) => {
    if (err) {
      console.error("ZIP Error", err);
      return;
    }
    writer.write(chunk);
    if (final) writer.close();
  });

  // Browser concurrency limit is 6 per origin
  // Batch into groups of 6 for predictable parallel behaviour
  const BATCH_SIZE = 6;

  for (let i = 0; i < songs.length; i += BATCH_SIZE) {
    if (signal?.aborted) break;
    
    const batch = songs.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (song) => {
      if (!song.audioUrl) {
         completed++;
         return;
      }

      // Pro DJ Naming Format: Song Name – Artist – BPM – Key
      // Note: Using placeholders for BPM/Key since Spotify Search doesn't return Audio Features by default.
      const filename = `${song.title} - ${song.artist} - 128 BPM.mp3`
        .replace(/[<>:"/\\|?*]/g, '');  // sanitise filename

      try {
        activeSongIds.push(song.id);
        const res = await fetch(song.audioUrl, { signal });
        if (!res.ok) {
           completed++;
           const index = activeSongIds.indexOf(song.id);
           if (index !== -1) activeSongIds.splice(index, 1);
           completedSongIds.push(song.id);
           return;
        }

        const entry = new ZipPassThrough(filename);
        zip.add(entry);

        const reader = res.body!.getReader();

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            entry.push(new Uint8Array(0), true);
            completed++;
            const index = activeSongIds.indexOf(song.id);
            if (index !== -1) activeSongIds.splice(index, 1);
            completedSongIds.push(song.id);
            emitProgress(song.title);
            break;
          }

          entry.push(value);
          bytesReceived += value.length;
          
          // Throttle UI updates a bit to avoid maxing out react renders
          const now = Date.now();
          if (now - lastUpdateTime > 100) {
            lastUpdateTime = now;
            emitProgress(song.title);
          }
        }
      } catch (err) {
        // Skip failed song — continue with rest or abort if requested
        if (signal?.aborted) {
          console.warn("Download aborted");
        } else {
          console.warn(`Skipped: ${song.title}`, err);
          completed++;
          completedSongIds.push(song.id);
        }
        const index = activeSongIds.indexOf(song.id);
        if (index !== -1) activeSongIds.splice(index, 1);
      }
    }));
  }

  zip.end();
}
