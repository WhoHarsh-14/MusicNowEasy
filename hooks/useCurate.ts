import { useState, useRef, useCallback } from 'react';
import { usePlaylist } from '@/lib/store';
import { CurateStage, Song } from '@/types';

export function useCurate() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<'idle' | 'curating' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { add } = usePlaylist();

  const curate = useCallback(async (query: string, count = 20, autoAdd = false) => {
    abortControllerRef.current?.abort();
    setSongs([]);
    setStatus('curating');
    setStatusMessage(null);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch('/api/curate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, count }),
        signal: abortController.signal,
      });

      if (!res.ok) throw new Error('Failed to curate');
      if (!res.body) throw new Error('No body returned');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? ''; // keep the last incomplete chunk

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (!dataStr) continue;
            
            try {
              const event = JSON.parse(dataStr) as CurateStage;

              if (event.type === 'song') {
                setSongs(prev => [...prev, event.song]);
                if (autoAdd) add(event.song);
              }

              if (event.type === 'done') {
                setStatus('done');
              }

              if (event.type === 'status') {
                setStatusMessage(event.message);
              }

              if (event.type === 'error') {
                setStatus('error');
                setError(event.message);
              }
            } catch (e) {
              console.error("Failed to parse SSE message", e);
            }
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setStatus('error');
      setError('Connection lost. Please try again.');
    }
  }, [add]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setStatus('idle');
    setStatusMessage(null);
  }, []);

  const clear = useCallback(() => {
    abortControllerRef.current?.abort();
    setSongs([]);
    setStatus('idle');
    setStatusMessage(null);
    setError(null);
  }, []);

  return { songs, status, statusMessage, error, curate, cancel, clear };
}
