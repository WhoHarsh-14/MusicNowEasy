"use client";

import { usePlayer } from "@/lib/store";

export function QueueDrawer() {
  const { queue, currentIndex, showQueue, toggleQueue, playContext } = usePlayer();

  if (!showQueue) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] transition-opacity"
        onClick={toggleQueue}
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-[calc(100vh-72px)] w-full max-w-md backdrop-blur-glass border-l border-border-strong z-[80] shadow-2xl flex flex-col translate-x-0 transition-transform">
        <div className="flex items-center justify-between p-6 border-b border-border-strong">
          <h2 className="font-display text-h2 font-bold text-primary">Up Next</h2>
          <button 
            onClick={toggleQueue}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-4">
          {queue.length === 0 ? (
            <div className="text-center text-text-tertiary mt-10">
              <span className="material-symbols-outlined text-[48px] mb-2 opacity-50">queue_music</span>
              <p className="font-body text-body">Queue is empty</p>
            </div>
          ) : (
            queue.map((song, idx) => {
              const isPlaying = idx === currentIndex;
              return (
                <div 
                  key={`${song.id}-${idx}`}
                  onClick={() => playContext(queue, idx)}
                  className={`flex items-center gap-4 p-2 rounded cursor-pointer transition-colors group ${
                    isPlaying ? 'bg-surface-container-low' : 'hover:bg-surface-container-highest'
                  }`}
                >
                  <div className="w-12 h-12 flex-shrink-0 relative rounded overflow-hidden">
                    <img 
                      src={song.albumArt || '/placeholder.png'} 
                      alt={song.title} 
                      className="w-full h-full object-cover"
                    />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>
                        {isPlaying ? 'volume_up' : 'play_arrow'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className={`font-body text-body font-semibold truncate ${isPlaying ? 'text-primary' : 'text-text-primary'}`}>
                      {song.title}
                    </p>
                    <p className="font-label text-label text-text-secondary truncate uppercase tracking-widest mt-1">
                      {song.artist}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
