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

export default function DownloadModal({
  isOpen,
  onCancel,
  onHide,
  progress,
  songs,
  playlistName
}: DownloadModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  // Derive percent from bytes, default to 0
  let percent = 0;
  if (progress && progress.estimatedTotal > 0) {
    percent = Math.floor((progress.bytesReceived / progress.estimatedTotal) * 100);
    percent = Math.min(100, Math.max(0, percent));
  }

  const radius = 52;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100 * circumference);

  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(1);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    return `~${Math.ceil(seconds / 60)}m`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      {/* MODAL CARD */}
      <div className="w-full max-w-[480px] bg-bg-raised border border-border-strong rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-h2 text-primary flex items-center gap-2">
            <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>download</span>
            Downloading playlist
          </h2>
          <p className="text-text-secondary font-body text-body mt-1 font-mono">{playlistName.replace(/[^a-z0-9]/gi, '-')}.zip</p>
        </div>

        {/* Modal Body */}
        <div className="p-8 flex flex-col items-center">
          {/* SVG Progress Ring */}
          <div className="relative flex items-center justify-center mb-8">
            <svg className="w-[120px] h-[120px] transform -rotate-90">
              <circle 
                className="text-border-strong" 
                cx="60" cy="60" 
                fill="transparent" 
                r={radius} 
                stroke="currentColor" 
                strokeWidth="6"
              />
              <circle 
                className="text-primary transition-all duration-300 ease-out" 
                cx="60" cy="60" 
                fill="transparent" 
                r={radius} 
                stroke="currentColor" 
                strokeDasharray={circumference} 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                strokeWidth="6"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="font-display text-[28px] font-bold text-white">{percent}%</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="w-full grid grid-cols-3 gap-4 border-y border-border py-4 mb-6">
            <div className="text-center">
              <span className="block font-label text-text-secondary uppercase">Progress</span>
              <span className="block font-body text-primary font-semibold">
                {progress ? formatSize(progress.bytesReceived) : 0} / {progress ? formatSize(progress.estimatedTotal) : 0} MB
              </span>
            </div>
            <div className="text-center border-x border-border">
              <span className="block font-label text-text-secondary uppercase">Speed</span>
              <span className="block font-body text-primary font-semibold">
                {progress ? progress.speedMBps.toFixed(1) : 0} MB/s
              </span>
            </div>
            <div className="text-center">
              <span className="block font-label text-text-secondary uppercase">Time</span>
              <span className="block font-body text-primary font-semibold">
                {progress ? formatTime(progress.timeRemainingSec) : 'Calc...'}
              </span>
            </div>
          </div>

          {/* Song List (Queue) */}
          <div className="w-full space-y-1 overflow-y-auto max-h-48 pr-2 custom-scrollbar">
            {songs.map((song) => {
              const isComplete = progress?.completedSongIds.includes(song.id);
              const isDownloading = progress?.activeSongIds.includes(song.id);
              const isPending = !isComplete && !isDownloading;

              // Derive size purely conceptually based on length for display since we don't have exact file sizes pre-download
              const sizeMB = formatSize(song.durationMs / 60000 * 1024 * 1024);

              return (
                <div 
                  key={song.id} 
                  className={`flex items-center justify-between h-[52px] px-3 rounded ${
                    isComplete ? 'bg-surface-container-low/50 group' :
                    isDownloading ? 'bg-bg-hover border border-gold-dark/30' :
                    'opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-sm bg-border overflow-hidden relative">
                      <img 
                        className={`w-full h-full object-cover ${isComplete ? 'grayscale' : ''}`} 
                        alt={song.title} 
                        src={song.albumArt || '/placeholder.png'} 
                      />
                      {isDownloading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-sm font-semibold truncate w-48 ${
                        isDownloading ? 'text-primary' : 
                        isComplete ? 'text-text-primary' : 
                        'text-text-secondary'
                      }`}>
                        {song.title}
                      </span>
                      <span className={`text-xs uppercase tracking-tighter ${
                        isDownloading ? 'text-primary/70' : 
                        'text-text-secondary'
                      }`}>
                        {sizeMB} MB • {isComplete ? 'COMPLETE' : isDownloading ? 'DOWNLOADING...' : 'PENDING'}
                      </span>
                    </div>
                  </div>
                  {isComplete ? (
                    <span className="material-symbols-outlined text-success">check_circle</span>
                  ) : isDownloading ? (
                    <span className="material-symbols-outlined text-primary animate-spin" style={{ animationDuration: '2s' }}>sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-text-secondary">radio_button_unchecked</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-surface-container-highest/50 flex justify-end gap-3 border-t border-border">
          <button onClick={onHide} className="px-6 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Hide Window
          </button>
          <button onClick={onCancel} className="px-6 py-2 text-sm font-semibold border border-border-strong hover:border-error/50 hover:text-error transition-all rounded">
            Cancel Download
          </button>
        </div>
      </div>
    </div>
  );
}
