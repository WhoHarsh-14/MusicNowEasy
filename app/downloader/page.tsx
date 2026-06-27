'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDownloadPlaylist } from '@/hooks/useDownloadPlaylist';
import { downloadPlaylist, DownloadProgress } from '@/lib/download';
import DownloadModal from '@/components/DownloadModal';
import type { Song } from '@/types';

// ── Platform detection (client-side, for real-time input feedback) ──────────
type PlatformInfo = {
  id: string;
  label: string;
  color: string;
  dotColor: string;
  icon: string;
  urlPattern: RegExp;
  validPattern: RegExp;
  invalidMsg?: string;
};

const PLATFORMS: PlatformInfo[] = [
  {
    id: 'spotify',
    label: 'Spotify',
    color: '#1DB954',
    dotColor: '#1DB954',
    icon: '🎵',
    urlPattern: /spotify\.com/,
    validPattern: /spotify\.com\/playlist\//,
    invalidMsg: 'This looks like a Spotify track or album — paste a playlist URL.',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    color: '#FF0000',
    dotColor: '#FF0000',
    icon: '▶',
    urlPattern: /youtube\.com|youtu\.be/,
    validPattern: /[?&]list=/,
    invalidMsg: 'YouTube playlist URLs must contain ?list=...',
  },
  {
    id: 'youtube-music',
    label: 'YouTube Music',
    color: '#FF0000',
    dotColor: '#FF0000',
    icon: '♪',
    urlPattern: /music\.youtube\.com/,
    validPattern: /[?&]list=/,
  },
  {
    id: 'apple-music',
    label: 'Apple Music',
    color: '#FC3C44',
    dotColor: '#FC3C44',
    icon: '♬',
    urlPattern: /music\.apple\.com/,
    validPattern: /music\.apple\.com/,
  },
];

function detectPlatformClient(url: string): { platform: PlatformInfo | null; isValid: boolean; message: string } {
  if (!url || !url.startsWith('http')) return { platform: null, isValid: false, message: '' };

  for (const p of PLATFORMS) {
    if (p.urlPattern.test(url)) {
      if (p.validPattern.test(url)) {
        return { platform: p, isValid: true, message: `✓ ${p.label} playlist detected` };
      }
      return {
        platform: p,
        isValid: false,
        message: p.invalidMsg ?? `This doesn't look like a ${p.label} playlist URL.`,
      };
    }
  }

  return { platform: null, isValid: false, message: url.includes('http') ? 'Platform not supported.' : '' };
}

// ── Format helpers ────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// ── Song Row Component ────────────────────────────────────────────────────────
function SongRow({ song, index, onDownload }: { song: Song; index: number; onDownload?: (song: Song) => void }) {
  const [imgError, setImgError] = useState(false);
  const isUnavailable = !song.audioUrl;

  return (
    <div
      className="song-row"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      {/* Album art */}
      <div className="song-art">
        {song.albumArt && !imgError ? (
          <img
            src={song.albumArt}
            alt={song.title}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="song-art-placeholder">♪</div>
        )}
      </div>

      {/* Title + artist */}
      <div className="song-info">
        <span className="song-title">{song.title}</span>
        <span className="song-artist">{song.artist}</span>
      </div>

      {/* Duration + status */}
      <div className="song-meta">
        {isUnavailable ? (
          <span className="badge-unavailable">Unavailable</span>
        ) : (
          <span className="song-duration">{formatDuration(song.durationMs)}</span>
        )}
        {!isUnavailable && onDownload && (
          <button
            className="song-dl-btn"
            onClick={() => onDownload(song)}
            title={`Download ${song.title}`}
          >
            ↓
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PlaylistDownloader() {
  const [inputUrl, setInputUrl] = useState('');
  const [songPage, setSongPage] = useState(0);
  const SONGS_PER_PAGE = 10;
  const [debouncedUrl, setDebouncedUrl] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Download modal state
  const [downloading, setDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const dlAbortRef = useRef<AbortController | null>(null);

  const { status, songs, total, resolved, platform, fromCache, statusMessage, error, fetchPlaylist, cancel } =
    useDownloadPlaylist();

  // ── Background stream URL pre-warmer ─────────────────────────────────────────
  // As soon as songs finish loading, silently resolve all ytsearch: URLs to
  // direct Google CDN URLs in the background. The /api/stream route caches them
  // for 2 hours, so clicking "Download All" after this costs 0ms for resolution.
  const prewarmRef = useRef<AbortController | null>(null);
  const [prewarming, setPrewarming] = useState(false);
  const [prewarmDone, setPrewarmDone] = useState(false);

  useEffect(() => {
    // Only pre-warm when we have a complete song list (status = idle/done)
    if (songs.length === 0 || status === 'fetching' || status === 'resolving') {
      setPrewarmDone(false);
      return;
    }
    const songsWithUrl = songs.filter(s => s.audioUrl?.includes('/api/stream'));
    if (songsWithUrl.length === 0) return;

    // Cancel any previous pre-warm
    prewarmRef.current?.abort();
    const ac = new AbortController();
    prewarmRef.current = ac;
    setPrewarming(true);
    setPrewarmDone(false);

    const PREWARM_BATCH = 2; // Reduced to 2 to avoid overwhelming local CPU and YouTube rate limits
    (async () => {
      for (let i = 0; i < songsWithUrl.length; i += PREWARM_BATCH) {
        if (ac.signal.aborted) break;
        const batch = songsWithUrl.slice(i, i + PREWARM_BATCH);
        await Promise.allSettled(
          batch.map(s =>
            fetch(`${s.audioUrl}&resolve=true`, { signal: ac.signal }).catch(() => {})
          )
        );
      }
      if (!ac.signal.aborted) {
        setPrewarming(false);
        setPrewarmDone(true);
      }
    })();

    return () => ac.abort();
  }, [songs, status]);

  // Debounce URL input for real-time platform detection
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedUrl(inputUrl), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputUrl]);

  const detection = useMemo(() => detectPlatformClient(debouncedUrl), [debouncedUrl]);

  const handleFetch = () => {
    if (!inputUrl.trim() || !detection.isValid) return;
    setSongPage(0);
    fetchPlaylist(inputUrl.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFetch();
  };

  const availableSongs = useMemo(() => songs.filter(s => s.audioUrl), [songs]);
  const unavailableCount = songs.length - availableSongs.length;

  const handleDownloadAll = async () => {
    if (availableSongs.length === 0) return;
    dlAbortRef.current?.abort();
    dlAbortRef.current = new AbortController();
    setDownloading(true);
    setIsModalOpen(true);
    setProgress(null);

    const playlistName = `Playlist (${availableSongs.length} songs)`;
    try {
      await downloadPlaylist(availableSongs, playlistName, (p) => setProgress(p), dlAbortRef.current.signal);
      setTimeout(() => setIsModalOpen(false), 2000);
    } finally {
      setDownloading(false);
    }
  };

  const handleCancelDownload = () => {
    dlAbortRef.current?.abort();
    setDownloading(false);
  };

  const isFetchActive = status === 'fetching' || status === 'resolving';
  const showResults = songs.length > 0 || isFetchActive;
  const progressPct = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <>
      <style>{pageStyles}</style>

      <div className="dl-page">
        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="dl-header">
          <h1 className="dl-title">Playlist Downloader</h1>
          <p className="dl-subtitle">Paste any playlist link to fetch and download all songs as ZIP</p>
        </div>

        {/* ── URL Input ────────────────────────────────────────── */}
        <div className="dl-input-wrap">
          <div className={`dl-input-bar ${detection.platform ? 'has-platform' : ''} ${inputUrl && !detection.isValid && debouncedUrl ? 'is-invalid' : ''}`}>
            {/* Left icon */}
            <div className="dl-input-icon">
              {detection.platform ? (
                <span style={{ color: detection.platform.color, fontSize: 20 }}>
                  {detection.platform.icon}
                </span>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              )}
            </div>

            <input
              id="playlist-url-input"
              className="dl-input"
              type="url"
              placeholder="Paste a Spotify, YouTube, or Apple Music playlist link..."
              value={inputUrl}
              onChange={e => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isFetchActive}
              autoComplete="off"
              autoFocus
            />

            {/* Right: button or spinner */}
            {isFetchActive ? (
              <button className="dl-cancel-btn" onClick={cancel}>
                <span className="dl-spinner" /> Cancel
              </button>
            ) : (
              <button
                id="fetch-tracks-btn"
                className="dl-fetch-btn"
                onClick={handleFetch}
                disabled={!detection.isValid}
              >
                Fetch Tracks →
              </button>
            )}
          </div>

          {/* Platform detection feedback */}
          {debouncedUrl && detection.message && (
            <div className={`dl-detection ${detection.isValid ? 'valid' : 'invalid'}`}>
              {detection.message}
            </div>
          )}

          {/* Supported platforms row */}
          <div className="dl-platforms">
            <span className="dl-platforms-label">Supported:</span>
            {PLATFORMS.map(p => (
              <span key={p.id} className="dl-platform-pill">
                <span className="dl-platform-dot" style={{ background: p.dotColor }} />
                {p.label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Results Area ─────────────────────────────────────── */}
        {showResults && (
          <div className="dl-results">

            {/* Progress header */}
            {(isFetchActive || status === 'done') && (
              <div className="dl-progress-wrap">
                <div className="dl-progress-header">
                  <span className="dl-progress-text">
                    {status === 'done' ? (
                      <span className="dl-done-text">
                        ✓ All {songs.length} songs ready
                        {unavailableCount > 0 && (
                          <span className="dl-unavailable-note">
                            {' '}({unavailableCount} unavailable)
                          </span>
                        )}
                        {fromCache && <span className="dl-cache-note"> · ⚡ from cache</span>}
                      </span>
                    ) : (
                      <>
                        {statusMessage || `Resolving audio · ${resolved} of ${total} songs ready`}
                      </>
                    )}
                  </span>

                  {/* Download All */}
                  {availableSongs.length > 0 && (
                    <button
                      id="download-all-btn"
                      className="dl-download-all-btn"
                      onClick={handleDownloadAll}
                      disabled={downloading}
                    >
                      ↓ Download All
                      <span className={`dl-ready-badge ${prewarmDone ? 'prewarm-done' : prewarming ? 'prewarming' : ''}`}>
                        {prewarming
                          ? '⚙ Preparing...'
                          : prewarmDone
                          ? '⚡ Ready'
                          : `${availableSongs.length} ready`}
                      </span>
                    </button>
                  )}

                </div>

                {/* Progress bar */}
                {total > 0 && status !== 'done' && (
                  <div className="dl-progress-bar">
                    <div
                      className="dl-progress-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Error state */}
            {status === 'error' && error && (
              <div className="dl-error">
                <span className="dl-error-icon">⚠</span>
                {error}
              </div>
            )}

            {/* Song list */}
            <div className="dl-song-list">
              {/* Loading skeletons while fetching */}
              {status === 'fetching' && songs.length === 0 && (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="song-row skeleton">
                    <div className="song-art skeleton-box" />
                    <div className="song-info">
                      <div className="skeleton-line wide" />
                      <div className="skeleton-line narrow" />
                    </div>
                  </div>
                ))
              )}

              {songs.slice(songPage * SONGS_PER_PAGE, (songPage + 1) * SONGS_PER_PAGE).map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={i}
                  onDownload={(s) => {
                    downloadPlaylist([s], s.title, () => {}, new AbortController().signal);
                  }}
                />
              ))}
            </div>

            {/* Pagination controls */}
            {songs.length > SONGS_PER_PAGE && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, paddingBottom: 8 }}>
                <button
                  onClick={() => setSongPage(p => Math.max(0, p - 1))}
                  disabled={songPage === 0}
                  className="dl-page-btn"
                >
                  ‹
                </button>
                {Array.from({ length: Math.ceil(songs.length / SONGS_PER_PAGE) }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSongPage(idx)}
                    className={`dl-page-btn ${songPage === idx ? 'active' : ''}`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setSongPage(p => Math.min(Math.ceil(songs.length / SONGS_PER_PAGE) - 1, p + 1))}
                  disabled={songPage >= Math.ceil(songs.length / SONGS_PER_PAGE) - 1}
                  className="dl-page-btn"
                >
                  ›
                </button>
                <span style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }}>
                  {songPage * SONGS_PER_PAGE + 1}–{Math.min((songPage + 1) * SONGS_PER_PAGE, songs.length)} of {songs.length} songs
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Empty idle state ──────────────────────────────────── */}
        {!showResults && status === 'idle' && (
          <div className="dl-empty">
            <div className="dl-empty-icon">⬇</div>
            <p className="dl-empty-text">Paste a playlist URL above to get started</p>
            <p className="dl-empty-hint">Supports Spotify, YouTube, YouTube Music, and Apple Music playlists</p>
          </div>
        )}
      </div>

      {/* Download modal */}
      {isModalOpen && (
        <DownloadModal
          isOpen={isModalOpen}
          onHide={() => setIsModalOpen(false)}
          onCancel={handleCancelDownload}
          progress={progress}
          songs={availableSongs}
          playlistName={`Playlist (${availableSongs.length} songs)`}
        />
      )}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pageStyles = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  .dl-page-btn {
    min-width: 34px; height: 34px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid rgba(201,168,76,0.25);
    background: rgba(201,168,76,0.06);
    color: #888;
    font-size: 14px; font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .dl-page-btn:hover:not(:disabled) {
    border-color: rgba(201,168,76,0.6);
    color: #C9A84C;
    background: rgba(201,168,76,0.12);
  }
  .dl-page-btn:disabled {
    opacity: 0.3; cursor: not-allowed;
  }
  .dl-page-btn.active {
    border-color: #C9A84C;
    background: rgba(201,168,76,0.2);
    color: #C9A84C;
  }

  .dl-page {
    max-width: 900px;
    margin: 0 auto;
    padding: 48px 32px 80px;
    font-family: 'Inter', system-ui, sans-serif;
  }

  /* Header */
  .dl-header { text-align: center; margin-bottom: 40px; }
  .dl-title {
    font-size: 32px; font-weight: 700; letter-spacing: -0.02em;
    color: #C9A84C; margin: 0 0 8px;
  }
  .dl-subtitle { font-size: 14px; color: #888; margin: 0; }

  /* Input */
  .dl-input-wrap { max-width: 760px; margin: 0 auto 40px; }
  .dl-input-bar {
    display: flex; align-items: center; gap: 0;
    height: 64px;
    background: #111;
    border: 1.5px solid #222;
    border-radius: 12px;
    padding: 0 8px 0 20px;
    transition: border-color 0.2s;
  }
  .dl-input-bar:focus-within { border-color: rgba(201,168,76,0.6); }
  .dl-input-bar.is-invalid:focus-within { border-color: rgba(244,67,54,0.6); }

  .dl-input-icon { display: flex; align-items: center; color: #555; flex-shrink: 0; margin-right: 12px; }

  .dl-input {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 14px; color: #F0F0F0; font-family: inherit;
    min-width: 0;
  }
  .dl-input::placeholder { color: #444; }
  .dl-input:disabled { opacity: 0.5; }

  .dl-fetch-btn {
    flex-shrink: 0;
    height: 44px; padding: 0 20px;
    background: #C9A84C; color: #0A0A0A;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; white-space: nowrap;
    transition: background 0.15s, opacity 0.15s;
    letter-spacing: 0.03em;
  }
  .dl-fetch-btn:hover:not(:disabled) { background: #E8C96A; }
  .dl-fetch-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .dl-cancel-btn {
    flex-shrink: 0;
    height: 44px; padding: 0 16px;
    background: #1A1A1A; color: #888;
    border: 1px solid #333; border-radius: 8px;
    font-size: 13px; font-family: inherit;
    cursor: pointer; display: flex; align-items: center; gap: 8px;
    transition: color 0.15s;
  }
  .dl-cancel-btn:hover { color: #F0F0F0; }

  .dl-spinner {
    width: 14px; height: 14px;
    border: 2px solid #444; border-top-color: #C9A84C;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  /* Detection feedback */
  .dl-detection {
    margin-top: 8px; padding-left: 20px;
    font-size: 12px;
  }
  .dl-detection.valid  { color: #4CAF50; }
  .dl-detection.invalid { color: #F44336; }

  /* Platform pills */
  .dl-platforms {
    display: flex; align-items: center; gap: 8px;
    margin-top: 12px; padding-left: 20px; flex-wrap: wrap;
  }
  .dl-platforms-label { font-size: 11px; color: #555; letter-spacing: 0.04em; }
  .dl-platform-pill {
    display: flex; align-items: center; gap: 4px;
    font-size: 11px; color: #555;
  }
  .dl-platform-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  /* Results */
  .dl-results { animation: fadeUp 0.3s ease both; }

  /* Progress */
  .dl-progress-wrap { margin-bottom: 20px; }
  .dl-progress-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 10px; gap: 16px;
  }
  .dl-progress-text { font-size: 13px; color: #888; }
  .dl-done-text { color: #4CAF50; font-weight: 500; }
  .dl-unavailable-note { color: #F44336; }
  .dl-cache-note { color: #C9A84C; }

  .dl-download-all-btn {
    display: flex; align-items: center; gap: 8px;
    height: 36px; padding: 0 16px;
    background: #C9A84C; color: #0A0A0A;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; font-family: inherit;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    transition: background 0.15s;
  }
  .dl-download-all-btn:hover:not(:disabled) { background: #E8C96A; }
  .dl-download-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .dl-ready-badge {
    background: rgba(0,0,0,0.25);
    padding: 2px 8px; border-radius: 999px;
    font-size: 11px; font-weight: 500;
    transition: background 0.3s, color 0.3s;
  }
  .dl-ready-badge.prewarming {
    background: rgba(201,168,76,0.15);
    color: rgba(201,168,76,0.7);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .dl-ready-badge.prewarm-done {
    background: rgba(76,175,80,0.2);
    color: #4CAF50;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .dl-progress-bar {
    height: 3px; background: #222; border-radius: 999px; overflow: hidden;
  }
  .dl-progress-fill {
    height: 100%; background: #C9A84C; border-radius: 999px;
    transition: width 0.4s ease;
  }

  /* Error */
  .dl-error {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 14px 16px;
    background: rgba(244,67,54,0.1);
    border: 1px solid rgba(244,67,54,0.3);
    border-radius: 8px;
    color: #F44336; font-size: 14px;
    margin-bottom: 20px;
  }
  .dl-error-icon { font-size: 16px; flex-shrink: 0; }

  /* Song list */
  .dl-song-list { display: flex; flex-direction: column; gap: 2px; }

  /* Song row */
  .song-row {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 14px;
    background: #111;
    border: 1px solid #1A1A1A;
    border-radius: 8px;
    animation: fadeUp 0.2s ease both;
    transition: border-color 0.15s, background 0.15s;
    min-height: 68px;
  }
  .song-row:hover { background: #161616; border-color: #252525; }

  .song-art {
    width: 44px; height: 44px; border-radius: 6px;
    overflow: hidden; flex-shrink: 0;
    background: #1A1A1A;
    display: flex; align-items: center; justify-content: center;
  }
  .song-art img { width: 100%; height: 100%; object-fit: cover; }
  .song-art-placeholder { font-size: 18px; color: #333; }

  .song-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .song-title {
    font-size: 14px; font-weight: 500; color: #F0F0F0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .song-artist {
    font-size: 12px; color: #888;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .song-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .song-duration { font-size: 12px; color: #555; font-variant-numeric: tabular-nums; }

  .badge-unavailable {
    font-size: 10px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(244,67,54,0.12); color: #F44336;
    border: 1px solid rgba(244,67,54,0.25);
  }

  .song-dl-btn {
    width: 28px; height: 28px;
    background: transparent; border: 1px solid #2A2A2A;
    border-radius: 6px; color: #555;
    cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .song-dl-btn:hover { border-color: rgba(201,168,76,0.5); color: #C9A84C; background: rgba(201,168,76,0.06); }

  /* Skeletons */
  .song-row.skeleton { pointer-events: none; }
  .skeleton-box {
    background: linear-gradient(90deg, #1A1A1A 25%, #222 50%, #1A1A1A 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
  }
  .skeleton-line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg, #1A1A1A 25%, #222 50%, #1A1A1A 75%);
    background-size: 400px 100%;
    animation: shimmer 1.4s ease infinite;
  }
  .skeleton-line.wide  { width: 65%; }
  .skeleton-line.narrow { width: 40%; margin-top: 4px; }

  /* Empty state */
  .dl-empty {
    text-align: center; padding: 80px 32px;
    color: #444;
  }
  .dl-empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
  .dl-empty-text { font-size: 15px; color: #555; margin: 0 0 8px; }
  .dl-empty-hint { font-size: 13px; color: #3A3A3A; margin: 0; }
`;
