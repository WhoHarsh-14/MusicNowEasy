"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/lib/store";

export function AudioPlayer() {
  const { currentSong, isPlaying, volume, toggle, pause, setVolume, next, prev, isShuffle, toggleShuffle, repeatMode, toggleRepeat, toggleQueue, showQueue } = usePlayer();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);

  // Sync state to audio element
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Playback failed:", e);
        pause(); // Auto-pause if browser blocks playback
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentSong]); // Re-run when song changes to trigger play()

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      if (duration) {
        setProgress((currentTime / duration) * 100);
      }
    }
  };

  const handleEnded = () => {
    next();
  };

  if (!currentSong) {
    return (
      <footer className="fixed bottom-0 left-0 w-full h-[72px] backdrop-blur-glass border-t border-border-strong z-[60] flex flex-col justify-center items-center">
        <p className="font-label text-label text-text-tertiary uppercase tracking-widest">Select a track to play</p>
      </footer>
    );
  }

  return (
    <footer className="fixed bottom-0 left-0 w-full h-[72px] backdrop-blur-glass border-t border-border-strong z-[60] flex flex-col">
      <audio 
        ref={audioRef}
        src={currentSong.audioUrl || ''}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      
      {/* Progress Bar (Full Width Top) */}
      <div className="w-full h-1 bg-border-strong relative cursor-pointer group" onClick={(e) => {
        if (!audioRef.current || !audioRef.current.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = pos * audioRef.current.duration;
      }}>
        <div 
          className="absolute top-0 left-0 h-full bg-primary group-hover:bg-gold-light transition-colors" 
          style={{ width: `${progress}%` }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 shadow-[0_0_8px_rgba(230,195,100,0.8)] transition-opacity"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <div className="flex-grow flex items-center justify-between px-4 md:px-margin-desktop">
        {/* Song Info */}
        <div className="flex items-center gap-3 w-1/4">
          <img 
            alt="Track Art" 
            className="w-10 h-10 rounded object-cover border border-border" 
            src={currentSong.albumArt || '/placeholder.png'} 
          />
          <div className="hidden sm:block overflow-hidden">
            <h5 className="font-body text-body font-semibold truncate">{currentSong.title}</h5>
            <p className="font-label text-[10px] text-text-secondary truncate tracking-wider uppercase">{currentSong.artist}</p>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-6">
          <button onClick={toggleShuffle} className={`${isShuffle ? 'text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors`}>
            <span className="material-symbols-outlined">shuffle</span>
          </button>
          <button onClick={prev} className="text-text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[28px]">skip_previous</span>
          </button>
          <button 
            onClick={toggle}
            className="w-10 h-10 bg-text-primary text-bg-base rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button onClick={next} className="text-text-secondary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[28px]">skip_next</span>
          </button>
          <button onClick={toggleRepeat} className={`${repeatMode !== 'none' ? 'text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors`}>
            <span className="material-symbols-outlined">{repeatMode === 'one' ? 'repeat_one' : 'repeat'}</span>
          </button>
        </div>
        
        {/* Volume & Extra */}
        <div className="flex items-center justify-end gap-4 w-1/4">
          <button onClick={toggleQueue} className={`${showQueue ? 'text-primary' : 'text-text-secondary hover:text-text-primary'} transition-colors hidden md:block`}>
            <span className="material-symbols-outlined">queue_music</span>
          </button>
          <div className="flex items-center gap-2 group cursor-pointer" onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            // The volume bar is 96px wide, offset by icon width approx 24px + 8px gap = 32px
            const clickX = e.clientX - rect.left - 32;
            if (clickX >= 0 && clickX <= 96) {
              setVolume(Math.max(0, Math.min(1, clickX / 96)));
            }
          }}>
            <span className="material-symbols-outlined text-text-secondary group-hover:text-text-primary">
              {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
            </span>
            <div className="w-24 h-1 bg-border-strong rounded-full overflow-hidden">
              <div 
                className="h-full bg-text-secondary group-hover:bg-primary transition-colors" 
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
