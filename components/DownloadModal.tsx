import { DownloadProgress } from '@/lib/download';
import { Song } from '@/types';
import { useEffect, useState } from 'react';

type DownloadModalProps = {
  isOpen: boolean;
  onCancel: () => void;
  onHide: () => void;
  progress: DownloadProgress | null;
  songs: Song[];
  playlistName: string;
};

const PAGE_SIZE = 8;

export default function DownloadModal({
  isOpen,
  onCancel,
  onHide,
  progress,
  songs,
  playlistName
}: DownloadModalProps) {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => { setMounted(true); }, []);

  // Auto-advance page to always show active downloads
  useEffect(() => {
    if (!progress?.activeSongIds.length) return;
    const firstActiveIndex = songs.findIndex(s => progress.activeSongIds.includes(s.id));
    if (firstActiveIndex >= 0) {
      const targetPage = Math.floor(firstActiveIndex / PAGE_SIZE);
      setPage(targetPage);
    }
  }, [progress?.activeSongIds, songs]);

  if (!mounted || !isOpen) return null;

  // Use song count for progress (far more accurate than byte estimation)
  const completed = progress?.completed ?? 0;
  const total = progress?.total ?? songs.length;
  const percent = total > 0 ? Math.min(100, Math.floor((completed / total) * 100)) : 0;

  const radius = 52;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100 * circumference);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds)) return '—';
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    return `~${Math.ceil(seconds / 60)}m`;
  };

  // Pagination
  const totalPages = Math.ceil(songs.length / PAGE_SIZE);
  const pageSongs = songs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const safeName = playlistName.replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      {/* MODAL CARD */}
      <div className="w-full max-w-[520px] bg-bg-raised border border-border-strong rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="p-5 border-b border-border flex items-start justify-between">
          <div>
            <h2 className="font-display text-h2 text-primary flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Downloading Playlist
            </h2>
            <p className="text-text-secondary font-body text-sm mt-0.5 font-mono truncate max-w-[360px]">
              {safeName || 'Playlist'}.zip
            </p>
          </div>
          {/* Song count badge */}
          <div className="text-right shrink-0">
            <span className="text-2xl font-bold text-primary">{completed}</span>
            <span className="text-text-secondary text-sm"> / {total}</span>
            <p className="text-text-secondary text-xs mt-0.5">songs done</p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">
          {/* Progress Ring */}
          <div className="relative flex items-center justify-center mb-6">
            <svg className="w-[120px] h-[120px] transform -rotate-90">
              <circle
                className="text-border-strong"
                cx="60" cy="60"
                fill="transparent"
                r={radius}
                stroke="currentColor"
                strokeWidth="7"
              />
              <circle
                className="text-primary transition-all duration-500 ease-out"
                cx="60" cy="60"
                fill="transparent"
                r={radius}
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="7"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-display text-[30px] font-bold text-white leading-none">{percent}%</span>
              <span className="text-text-secondary text-[10px] uppercase tracking-widest mt-0.5">complete</span>
            </div>
          </div>

          {/* Stats */}
          <div className="w-full grid grid-cols-3 gap-3 border-y border-border py-4 mb-5 text-center">
            <div>
              <span className="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1">Downloaded</span>
              <span className="block text-sm font-bold text-primary">
                {progress ? formatBytes(progress.bytesReceived) : '0 KB'}
              </span>
            </div>
            <div className="border-x border-border">
              <span className="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1">Speed</span>
              <span className="block text-sm font-bold text-primary">
                {progress?.speedMBps ? `${progress.speedMBps.toFixed(1)} MB/s` : '—'}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-semibold text-text-secondary uppercase tracking-widest mb-1">ETA</span>
              <span className="block text-sm font-bold text-primary">
                {progress ? formatTime(progress.timeRemainingSec) : '—'}
              </span>
            </div>
          </div>

          {/* Song list with pagination */}
          <div className="w-full">
            {/* Pagination header */}
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs text-text-secondary">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, songs.length)} of {songs.length} songs
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <span className="text-xs text-text-secondary px-1 tabular-nums">{page + 1}/{totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:text-primary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>

            {/* Song rows */}
            <div className="space-y-1">
              {pageSongs.map((song) => {
                const isComplete = progress?.completedSongIds.includes(song.id);
                const isDownloading = progress?.activeSongIds.includes(song.id);

                return (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between h-[52px] px-3 rounded-lg transition-all ${
                      isComplete
                        ? 'bg-surface-container-low/40'
                        : isDownloading
                        ? 'bg-bg-hover border border-primary/20'
                        : 'opacity-45'
                    }`}
                  >
                    {/* Album art */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded bg-border overflow-hidden relative shrink-0">
                        <img
                          className={`w-full h-full object-cover ${isComplete ? 'grayscale-[60%]' : ''}`}
                          alt=""
                          src={song.albumArt || '/placeholder.png'}
                        />
                        {isDownloading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Title + status */}
                      <div className="flex flex-col min-w-0">
                        <span className={`text-sm font-semibold truncate max-w-[240px] ${
                          isDownloading ? 'text-primary' :
                          isComplete ? 'text-text-primary' :
                          'text-text-secondary'
                        }`}>
                          {song.title}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wide ${
                          isDownloading ? 'text-primary/70' : 'text-text-secondary'
                        }`}>
                          {song.artist}
                          {isComplete ? ' • ✓ Done' : isDownloading ? ' • Downloading…' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Status icon */}
                    <div className="shrink-0 ml-2">
                      {isComplete ? (
                        <span className="material-symbols-outlined text-[18px] text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      ) : isDownloading ? (
                        <span className="material-symbols-outlined text-[18px] text-primary animate-spin" style={{ animationDuration: '2s' }}>sync</span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px] text-text-secondary/30">radio_button_unchecked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-surface-container-highest/40 flex justify-between items-center border-t border-border">
          {/* Progress bar mini */}
          <div className="flex-1 mr-6">
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onHide}
              className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors rounded"
            >
              Hide
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-semibold border border-border-strong hover:border-red-500/60 hover:text-red-400 transition-all rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
