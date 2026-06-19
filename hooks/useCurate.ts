import { useState, useRef, useCallback } from 'react';
import { usePlaylist } from '@/lib/store';
import { CurateStage, Song } from '@/types';

export function useCurate() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [status, setStatus] = useState<'idle' | 'curating' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const { add } = usePlaylist();

  const curate = useCallback((query: string, count = 20, autoAdd = false) => {
    // Close any existing SSE connection
    esRef.current?.close();
    setSongs([]);
    setStatus('curating');
    setError(null);

    const es = new EventSource(`/api/curate?q=${encodeURIComponent(query)}&n=${count}`);
    esRef.current = es;

    es.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(data) as CurateStage;

        if (event.type === 'song') {
          setSongs(prev => [...prev, event.song]);
          if (autoAdd) add(event.song);  // auto-add to playlist tray
        }

        if (event.type === 'done') {
          setStatus('done');
          es.close();
        }

        if (event.type === 'error') {
          setStatus('error');
          setError(event.message);
          es.close();
        }
      } catch (e) {
         console.error("Failed to parse SSE message", e);
      }
    };

    es.onerror = () => {
      setStatus('error');
      setError('Connection lost. Please try again.');
      es.close();
    };
  }, [add]);

  const cancel = useCallback(() => {
    esRef.current?.close();
    setStatus('idle');
  }, []);

  const clear = useCallback(() => {
    esRef.current?.close();
    setSongs([]);
    setStatus('idle');
    setError(null);
  }, []);

  return { songs, status, error, curate, cancel, clear };
}
