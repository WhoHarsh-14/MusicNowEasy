"use client";

import { useEffect, useState } from 'react';

export default function TitleBar() {
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Only show the custom title bar if we are running inside Electron
    if (typeof window !== 'undefined' && (window as any).electron) {
      setIsElectron(true);
    }
  }, []);

  if (!isElectron) return null;

  return (
    <div 
      className="w-full h-8 bg-[#0a0a0a] border-b border-border-strong flex justify-between items-center select-none sticky top-0 left-0 z-[60]"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="pl-4 font-display text-[12px] font-bold tracking-widest text-primary uppercase flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px]">album</span>
        MusicNowEasy
      </div>
      
      <div className="flex h-full" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => (window as any).electron.minimize()}
          className="h-full w-12 hover:bg-surface-container transition-colors text-text-tertiary hover:text-text-primary flex items-center justify-center"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 5H10V6H0V5Z" fill="currentColor" />
          </svg>
        </button>
        <button 
          onClick={() => (window as any).electron.maximize()}
          className="h-full w-12 hover:bg-surface-container transition-colors text-text-tertiary hover:text-text-primary flex items-center justify-center"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1H9V9H1V1ZM2 2V8H8V2H2Z" fill="currentColor" />
          </svg>
        </button>
        <button 
          onClick={() => (window as any).electron.close()}
          className="h-full w-12 hover:bg-[#e81123] hover:text-white transition-colors text-text-tertiary flex items-center justify-center"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.17157 0.464478L5 4.29291L8.82843 0.464478L9.53553 1.17158L5.70711 5.00001L9.53553 8.82844L8.82843 9.53554L5 5.70712L1.17157 9.53554L0.464466 8.82844L4.29289 5.00001L0.464466 1.17158L1.17157 0.464478Z" fill="currentColor" />
          </svg>
        </button>
      </div>
    </div>
  );
}
