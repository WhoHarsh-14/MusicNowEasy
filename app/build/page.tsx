"use client";

import { useState, useEffect, useRef } from 'react';
import { useCurate } from '@/hooks/useCurate';
import { usePlaylist, usePlayer, useCatalogueStore } from '@/lib/store';
import { downloadPlaylist, DownloadProgress } from '@/lib/download';
import DownloadModal from '@/components/DownloadModal';

export default function Home() {
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(20);
  const { songs, status, error, curate, cancel, clear: clearResults } = useCurate();
  const { add, songs: playlistSongs, remove, clear, totalBytes } = usePlaylist();
  const { currentSong, isPlaying, playContext, toggle } = usePlayer();
  
  const [mounted, setMounted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [playlistName, setPlaylistName] = useState('EventBros Masterset');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const savePlaylistAsCollection = useCatalogueStore(state => state.savePlaylistAsCollection);

  useEffect(() => setMounted(true), []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      curate(query, count);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setIsModalOpen(true);
    setProgress(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      await downloadPlaylist(playlistSongs, "EventBros_Playlist", (p) => {
        setProgress(p);
      }, controller.signal);
      
      // Delay closing slightly so the user sees the 100% completion state
      setTimeout(() => setIsModalOpen(false), 1500);
    } catch (e) {
      console.error("Download failed:", e);
      if (!controller.signal.aborted) {
        alert("Download failed.");
      }
    } finally {
      setDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsModalOpen(false);
    setDownloading(false);
  };

  const handleSaveToCatalogue = () => {
    if (playlistSongs.length === 0 || !playlistName.trim()) return;
    savePlaylistAsCollection(playlistName, playlistSongs);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <main className="pt-16 pb-[72px] px-margin-desktop grid grid-cols-1 md:grid-cols-10 gap-8 h-screen">
      {/* Left: Search Area (60%) */}
      <section className="md:col-span-6 flex flex-col h-full overflow-hidden">
        {/* AI Search Bar */}
        <div className="mt-8 space-y-6">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-primary">
              <span className="material-symbols-outlined text-[24px]">search</span>
            </div>
            <input 
              className="w-full h-14 bg-bg-raised border border-border text-text-primary pl-14 pr-4 rounded-lg focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all font-body text-body-lg placeholder:text-text-tertiary" 
              placeholder="Ask for any playlist... (e.g. 90s Bollywood romance)" 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={status === 'curating'}
            />
            <div className="absolute inset-y-0 right-4 flex items-center gap-2">
              <input 
                type="number"
                min={1}
                max={1000}
                value={count || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (isNaN(val)) setCount(0 as any); // allow clearing input temporarily
                  else if (val <= 1000) setCount(val);
                }}
                onBlur={() => {
                  if (!count || count < 1) setCount(10);
                  if (count > 1000) setCount(1000);
                }}
                className="w-14 bg-surface-container-highest border border-border-strong text-text-secondary text-xs font-bold rounded px-2 h-8 outline-none focus:border-primary text-center"
                disabled={status === 'curating'}
              />
              {status === 'curating' ? (
                <button
                  type="button"
                  onClick={cancel}
                  className="bg-error/20 text-error h-8 px-3 rounded text-xs font-bold hover:bg-error/30 transition-colors"
                >
                  STOP
                </button>
              ) : (
                <button type="submit" className="hidden" />
              )}
            </div>
          </form>


        </div>

        {error && (
          <div className="mt-4 bg-error/10 border border-error/20 text-error p-4 rounded-xl font-body text-sm">
            {error}
          </div>
        )}

        {status === 'curating' && songs.length === 0 && (
          <div className="flex-grow flex flex-col items-center justify-center text-text-tertiary space-y-4">
            <div className="w-10 h-10 border-4 border-surface-container-highest border-t-primary rounded-full animate-spin" />
            <p className="animate-pulse font-body text-body font-medium uppercase tracking-widest">Waking up the DJ...</p>
          </div>
        )}

        {songs.length > 0 && (
          <div className="flex justify-between items-center mt-6 mb-2 pr-4">
            <h3 className="font-display text-h3 text-text-secondary font-bold text-sm uppercase tracking-widest">Results</h3>
            <div className="flex items-center gap-6">
              <button
                onClick={() => { clearResults(); setQuery(''); }}
                className="text-text-tertiary hover:text-error transition-colors font-label text-[10px] uppercase tracking-widest flex items-center gap-1 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </button>
              <button
                onClick={() => songs.forEach(song => { if (!playlistSongs.some(s => s.id === song.id) && song.audioUrl) add(song); })}
                className="text-primary hover:text-gold-light transition-colors font-label text-[10px] uppercase tracking-widest flex items-center gap-1 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">playlist_add</span>
                Add All
              </button>
            </div>
          </div>
        )}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-4">
          <div className="space-y-1">
            {songs.map((song, i) => {
              const inPlaylist = playlistSongs.some(s => s.id === song.id);
              const isThisPlaying = currentSong?.id === song.id;
              
              return (
                <div key={song.id || i} className={`flex items-center gap-4 h-[60px] px-3 rounded-lg transition-colors group ${inPlaylist ? 'bg-bg-active' : 'hover:bg-surface-container-low'}`}>
                  <div className="w-12 h-12 rounded-sm bg-surface-container-highest overflow-hidden flex-shrink-0 relative">
                    <img alt={song.title} src={song.albumArt || '/placeholder.png'} className="w-full h-full object-cover" />
                    <div 
                      className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity cursor-pointer ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      onClick={() => isThisPlaying ? toggle() : playContext(songs, i)}
                    >
                      <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>
                        {isThisPlaying && isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <h4 className="font-body text-body font-semibold truncate text-text-primary">{song.title}</h4>
                    <p className="font-body text-body text-text-secondary truncate">{song.artist} {song.mood ? `• ${song.mood}` : ''}</p>
                  </div>
                  <div className="hidden sm:flex gap-2">
                    {song.language && <span className="px-2 py-0.5 rounded-full border border-border-strong text-[10px] font-bold text-text-secondary tracking-widest uppercase">{song.language.substring(0, 2)}</span>}
                  </div>
                  <div className="text-text-secondary font-label text-label w-12 text-right">
                    {/* Placeholder duration since API doesn't return it currently */}
                    00:00
                  </div>
                  {song.audioUrl ? (
                    <button 
                      onClick={() => !inPlaylist && add(song)} 
                      disabled={inPlaylist}
                      className={`p-2 transition-all active:scale-90 ${inPlaylist ? 'text-primary' : 'text-text-secondary hover:text-primary'}`}
                    >
                      <span className="material-symbols-outlined" style={{fontVariationSettings: inPlaylist ? "'FILL' 1" : "'FILL' 0"}}>
                        {inPlaylist ? 'check_circle' : 'add_circle'}
                      </span>
                    </button>
                  ) : (
                    <div className="text-error font-label text-[10px] uppercase px-2">Failed</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right: Playlist Tray (40%) */}
      <aside className="md:col-span-4 flex flex-col h-full overflow-hidden bg-surface-container-lowest border-l border-border-strong px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-h3 text-primary font-bold">My Playlist</h2>
          <div className="flex items-center gap-2">
            <button onClick={clear} disabled={!mounted || playlistSongs.length === 0} className="text-text-secondary hover:text-text-primary font-label text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50">
              Clear All
            </button>
            <div className="bg-surface-container-highest px-3 py-1 rounded-full border border-border">
              <span className="font-label text-label text-text-primary tracking-widest">{mounted ? playlistSongs.length : 0} SONGS</span>
            </div>
          </div>
        </div>
        
        <div className="mb-6">
          <input 
            className="w-full bg-transparent border-b border-border focus:border-primary text-h2 font-display font-semibold px-0 py-2 focus:ring-0 transition-all outline-none text-text-primary placeholder:text-text-tertiary" 
            placeholder="Enter Playlist Name" 
            type="text" 
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
          />
        </div>

        {/* Scrollable List of Added Songs */}
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 mb-6">
          {!mounted || playlistSongs.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-text-tertiary">
              <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">library_music</span>
              <p className="font-body text-body">Tray is empty.</p>
              <p className="font-label text-label uppercase tracking-widest mt-2">Add songs to build set</p>
            </div>
          ) : (
            <div className="space-y-4">
              {playlistSongs.map(song => {
                const isThisPlaying = currentSong?.id === song.id;
                return (
                <div key={song.id} className={`flex items-center gap-3 py-2 group ${isThisPlaying ? 'bg-surface-container-low rounded px-2 -mx-2' : ''}`}>
                  <div className="w-10 h-10 rounded bg-surface-container-high flex-shrink-0 overflow-hidden relative cursor-pointer" onClick={() => isThisPlaying ? toggle() : playContext(playlistSongs, playlistSongs.findIndex(s => s.id === song.id))}>
                    <img alt={song.title} src={song.albumArt || '/placeholder.png'} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <span className="material-symbols-outlined text-primary text-[20px]" style={{fontVariationSettings: "'FILL' 1"}}>
                        {isThisPlaying && isPlaying ? 'pause' : 'play_arrow'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className={`font-body text-body font-medium truncate ${isThisPlaying ? 'text-primary' : 'text-text-primary'}`}>{song.title}</p>
                    <p className="font-label text-[10px] text-text-tertiary tracking-wider uppercase">High Q</p>
                  </div>
                  <button onClick={() => remove(song.id)} className="p-1 text-text-tertiary hover:text-error transition-colors opacity-0 group-hover:opacity-100">
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              )})}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="mt-auto space-y-4 pt-4 border-t border-border-strong flex flex-col gap-2">
          <div className="flex justify-between items-center text-text-secondary font-label text-label tracking-widest px-1">
            <span>EST. SIZE</span>
            <span className="text-text-primary">~{mounted ? (totalBytes() / 1024 / 1024).toFixed(1) : '0.0'} MB</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleSaveToCatalogue}
              disabled={!mounted || playlistSongs.length === 0 || saveSuccess}
              className={`flex-1 h-12 rounded-lg font-body font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${saveSuccess ? 'bg-green-600/20 text-green-500 border border-green-600/30' : 'bg-surface-container-high hover:bg-surface-container-highest text-text-primary border border-border-strong'}`}
            >
              <span className="material-symbols-outlined">{saveSuccess ? 'check' : 'library_add'}</span>
              {saveSuccess ? 'SAVED' : 'CATALOGUE'}
            </button>
            <button 
              onClick={handleDownload}
              disabled={!mounted || playlistSongs.length === 0 || downloading}
              className="flex-[2] bg-primary text-on-primary h-12 rounded-lg font-body font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.98] gold-glow disabled:opacity-50 disabled:active:scale-100"
            >
              {downloading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">sync</span>
                  {progress ? `DL ${((progress.bytesReceived / progress.estimatedTotal) * 100).toFixed(0)}%` : 'STARTING...'}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">download</span>
                  DOWNLOAD ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
      <DownloadModal
        isOpen={isModalOpen}
        onCancel={handleCancelDownload}
        onHide={() => setIsModalOpen(false)}
        progress={progress}
        songs={playlistSongs}
        playlistName="EventBros_Playlist"
      />
    </main>
  );
}
