"use client";

import { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCatalogueStore, usePlayer, usePlaylist } from '@/lib/store';
import { useAICurate } from '@/hooks/useAICurate';
import { downloadPlaylist, DownloadProgress } from '@/lib/download';
import DownloadModal from '@/components/DownloadModal';

export default function CatalogueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  
  const collection = useCatalogueStore(state => state.collections.find(c => c.id === id));
  const updateCollectionSongs = useCatalogueStore(state => state.updateCollectionSongs);
  
  const { currentSong, isPlaying, playContext, toggle } = usePlayer();
  const { add, songs: playlistSongs } = usePlaylist();
  const { songs: aiSongs, status, curate } = useAICurate();

  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [customLimit, setCustomLimit] = useState<number>(50);
  const hasAppended = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // When AI finishes curating, auto-save to the store!
  useEffect(() => {
    if (status === 'done' && aiSongs.length > 0) {
      const newSongs = hasAppended.current ? [...(collection?.songs || []), ...aiSongs] : aiSongs;
      updateCollectionSongs(id, newSongs);
      hasAppended.current = false;
    }
  }, [status, aiSongs, id, updateCollectionSongs, collection?.songs]);

  if (!mounted) return null;

  if (!collection) {
    return (
      <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop min-h-[calc(100vh-72px)] flex items-center justify-center flex-col">
        <h1 className="text-2xl text-primary font-bold mb-4">Collection Not Found</h1>
        <Link href="/" className="text-text-secondary hover:text-text-primary underline">Back to Catalogue</Link>
      </main>
    );
  }

  const baseSongs = collection?.songs || [];
  const isCurating = status === 'curating';
  const activeSongs = isCurating 
    ? (hasAppended.current ? [...baseSongs, ...aiSongs] : aiSongs)
    : (baseSongs.length > 0 ? baseSongs : aiSongs);
    
  const isFilled = activeSongs.length > 0;

  const handleMagicFill = (append = false) => {
    hasAppended.current = append;
    const excludeList = append ? baseSongs.map(s => `${s.title} by ${s.artist}`) : [];
    const count = append ? 50 : customLimit;
    curate(`${collection.title} essentials, top hits`, count, false, false, excludeList);
  };

  const handleDownload = async () => {
    if (!activeSongs || activeSongs.length === 0) return;
    
    setIsDownloading(true);
    setIsModalOpen(true);
    setProgress(null);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      // Safe filename
      const safeName = collection.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await downloadPlaylist(activeSongs, `BeatVault_${safeName}`, (p) => {
        setProgress(p);
      }, controller.signal);
      
      setTimeout(() => setIsModalOpen(false), 1500);
    } catch (e) {
      console.error("Download failed:", e);
      if (!controller.signal.aborted) {
        alert("Download failed.");
      }
    } finally {
      setIsDownloading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsModalOpen(false);
    setIsDownloading(false);
  };

  return (
    <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop min-h-[calc(100vh-72px)] w-full">
      <div className="mb-6">
        <Link href="/" className="text-text-secondary hover:text-text-primary flex items-center gap-2 font-label text-[10px] uppercase tracking-widest font-bold w-fit transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Catalogue
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-4 mb-4">
            <span className="font-number text-primary text-4xl font-bold">{collection.id}</span>
            <div className="flex gap-2">
              {collection.tags.map(t => (
                <span key={t} className="font-label text-[10px] uppercase border border-primary/30 px-2 py-0.5 rounded-full text-primary">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold text-text-primary tracking-tighter leading-none mb-2">{collection.title}</h1>
          <p className="font-body text-text-secondary text-lg">
            {isFilled ? `${activeSongs.length} Tracks Selected` : `0 Tracks (Estimated ${collection.count} total in library)`}
          </p>
        </div>
        
        {isFilled && (
          <div className="flex gap-4">
            <button 
              onClick={() => handleMagicFill(true)}
              disabled={isCurating}
              className="shrink-0 bg-surface-container-highest border border-border text-text-primary h-14 px-6 rounded-lg font-body font-bold flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <span className="material-symbols-outlined">magic_button</span>
              MORE MAGIC FILL (+50)
            </button>
            <button 
              onClick={handleDownload}
              disabled={isDownloading || isCurating}
              className="shrink-0 bg-primary text-on-primary h-14 px-8 rounded-lg font-body font-bold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.98] gold-glow disabled:opacity-50"
            >
              {isDownloading ? (
                <><span className="material-symbols-outlined animate-spin">sync</span> Preparing...</>
              ) : (
                <><span className="material-symbols-outlined">download</span> DOWNLOAD ZIP</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Tracklist Area */}
      {!isFilled && status === 'idle' && (
        <div className="bg-surface-container rounded-xl border border-border p-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto shadow-2xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[40px] text-primary">auto_awesome</span>
          </div>
          <h3 className="font-display text-2xl font-bold text-text-primary mb-2">Category Not Cached</h3>
          <p className="font-body text-text-secondary mb-8">This is a default library category. To download it, we first need to extract and cache the actual tracks.</p>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-start gap-1">
              <label className="text-xs font-label text-text-tertiary uppercase tracking-widest">Amount</label>
              <input 
                type="number" 
                min="20" 
                max="150" 
                value={customLimit}
                onChange={(e) => setCustomLimit(Math.min(150, Math.max(20, parseInt(e.target.value) || 50)))}
                className="bg-surface-container-highest border border-border text-text-primary h-12 w-24 rounded-lg font-body text-center focus:border-primary focus:outline-none transition-colors"
              />
            </div>
            <button 
              onClick={() => handleMagicFill(false)}
              className="mt-5 bg-surface-container-highest border border-border-strong text-text-primary h-12 px-8 rounded-lg font-body font-bold flex items-center justify-center gap-2 hover:border-primary transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-primary">magic_button</span>
              MAGIC FILL
            </button>
          </div>
        </div>
      )}

      {status === 'curating' && (
        <div className="flex flex-col items-center justify-center py-20 text-text-tertiary space-y-4">
          <div className="w-12 h-12 border-4 border-surface-container-highest border-t-primary rounded-full animate-spin" />
          <p className="animate-pulse font-body text-body font-medium uppercase tracking-widest">Extracting {collection.title} Tracks...</p>
        </div>
      )}

      {isFilled && (
        <div className="bg-surface-container-lowest border border-border-strong rounded-xl overflow-hidden">
          {activeSongs.map((song, i) => {
            const inPlaylist = playlistSongs.some(s => s.id === song.id);
            const isThisPlaying = currentSong?.id === song.id;
            
            return (
              <div key={song.id || i} className={`flex items-center gap-4 h-[72px] px-4 border-b border-border-strong/50 last:border-0 transition-colors group ${isThisPlaying ? 'bg-surface-container-low' : 'hover:bg-surface-container'}`}>
                <div className="font-number text-text-tertiary w-6 text-right text-sm">{i + 1}</div>
                
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 relative">
                  <img alt={song.title} src={song.albumArt || '/placeholder.png'} className="w-full h-full object-cover" />
                  <div 
                    className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity cursor-pointer ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    onClick={() => isThisPlaying ? toggle() : playContext(activeSongs, i)}
                  >
                    <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>
                      {isThisPlaying && isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </div>
                </div>
                
                <div className="flex-grow min-w-0">
                  <h4 className={`font-body text-base font-semibold truncate ${isThisPlaying ? 'text-primary' : 'text-text-primary'}`}>{song.title}</h4>
                  <p className="font-body text-sm text-text-secondary truncate">{song.artist}</p>
                </div>

                <div className="text-text-secondary font-label text-label w-12 text-right">
                  00:00
                </div>

                {song.audioUrl ? (
                  <button 
                    onClick={() => !inPlaylist && add(song)} 
                    disabled={inPlaylist}
                    className={`p-3 transition-all active:scale-90 ${inPlaylist ? 'text-primary' : 'text-text-secondary hover:text-primary group-hover:scale-110'}`}
                    title={inPlaylist ? "In Build Playlist" : "Add to Build Playlist"}
                  >
                    <span className="material-symbols-outlined text-[20px]" style={{fontVariationSettings: inPlaylist ? "'FILL' 1" : "'FILL' 0"}}>
                      {inPlaylist ? 'check_circle' : 'add_circle'}
                    </span>
                  </button>
                ) : (
                  <div className="text-error font-label text-[10px] uppercase px-3">Failed</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DownloadModal
        isOpen={isModalOpen}
        onCancel={handleCancelDownload}
        onHide={() => setIsModalOpen(false)}
        progress={progress}
        songs={activeSongs}
        playlistName={`BeatVault_${collection.title}`}
      />
    </main>
  );
}
