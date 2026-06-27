'use client';

import { useState, useRef, useCallback } from 'react';
import type { Song } from '@/types';

export type DownloadPlaylistStatus = 'idle' | 'fetching' | 'resolving' | 'done' | 'error';

export type DownloadPlaylistState = {
  status: DownloadPlaylistStatus;
  songs: Song[];
  total: number;
  resolved: number;
  platform: string | null;
  fromCache: boolean;
  statusMessage: string;
  error: string | null;
};

const INITIAL_STATE: DownloadPlaylistState = {
  status: 'idle',
  songs: [],
  total: 0,
  resolved: 0,
  platform: null,
  fromCache: false,
  statusMessage: '',
  error: null,
};

export function useDownloadPlaylist() {
  const [state, setState] = useState<DownloadPlaylistState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);

  const fetchPlaylist = useCallback((url: string) => {
    // Close any existing connection
    esRef.current?.close();

    setState({
      ...INITIAL_STATE,
      status: 'fetching',
      statusMessage: 'Connecting...',
    });

    const es = new EventSource(`/api/download-playlist?url=${encodeURIComponent(url)}`);
    esRef.current = es;

    es.onmessage = ({ data }) => {
      try {
        const event = JSON.parse(data);

        if (event.type === 'status') {
          setState(s => ({ ...s, statusMessage: event.message }));
        }

        if (event.type === 'meta') {
          setState(s => ({
            ...s,
            status: 'resolving',
            total: event.total,
            platform: event.platform,
            fromCache: event.fromCache,
            statusMessage: event.fromCache
              ? `⚡ Loaded from cache · ${event.total} songs ready instantly`
              : `Resolving audio for ${event.total} songs...`,
          }));
        }

        if (event.type === 'song') {
          setState(s => ({
            ...s,
            songs: [...s.songs, event.song],
            resolved: s.resolved + 1,
          }));
        }

        if (event.type === 'done') {
          setState(s => ({
            ...s,
            status: 'done',
            statusMessage: '',
          }));
          es.close();
        }

        if (event.type === 'error') {
          setState(s => ({
            ...s,
            status: 'error',
            error: event.message,
          }));
          es.close();
        }
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setState(s => ({
        ...s,
        status: 'error',
        error: 'Connection lost. Please try again.',
      }));
      es.close();
    };
  }, []);

  const cancel = useCallback(() => {
    esRef.current?.close();
    setState(INITIAL_STATE);
  }, []);

  return { ...state, fetchPlaylist, cancel };
}
