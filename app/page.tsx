"use client";

import { useState } from 'react';
import Link from 'next/link';

import { useCatalogueStore, usePlaylist, usePlayer } from '@/lib/store';
import { useCurate } from '@/hooks/useCurate';
import { CreateCategoryModal } from '@/components/CreateCategoryModal';

export default function CataloguePage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const collections = useCatalogueStore(state => state.collections);
  const { add, songs: playlistSongs } = usePlaylist();
  
  // Get unique folders and count subcategories
  const folderStats = collections.reduce((acc, c) => {
    const folder = c.folder || 'Uncategorized';
    if (!acc[folder]) acc[folder] = 0;
    acc[folder]++;
    return acc;
  }, {} as Record<string, number>);

  const FOLDER_IMAGES: Record<string, string> = {
    "Retro / Old School": "/images/folders/Retro_Old_School.jpg?v=3",
    "Haldi / Mehendi": "/images/folders/Haldi_Mehendi.jpg?v=3",
    "Wedding Special": "/images/folders/Wedding_Special.jpg?v=3",
    "Chill / Lounge": "/images/folders/Chill_Lounge.jpg?v=3",
    "Corporate Event": "/images/folders/Corporate_Event.jpg?v=3",
    "Punjabi": "/images/folders/Punjabi.jpg?v=3",
    "Hip Hop / Rap": "/images/folders/Hip_Hop_Rap.jpg?v=3",
    "EDM / Club": "/images/folders/EDM_Club.jpg?v=3",
    "Bollywood Commercial": "/images/folders/Bollywood_Commercial.jpg?v=3",
    "Regional": "/images/folders/Regional.jpg?v=3",
    "Festival Special": "/images/folders/Festival_Special.jpg?v=3",
    "DJ Tools": "/images/folders/DJ_Tools.jpg?v=3",
    "Crowd Control / Emergency": "/images/folders/Crowd_Control_Emergency.jpg?v=3",
    "Ready Playlists": "/images/folders/Ready_Playlists.jpg?v=3"
  };

  const sortedFolders = Object.keys(folderStats).sort((a, b) => {
    if (a === 'My Custom Categories') return 1;
    if (b === 'My Custom Categories') return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  const { currentSong, isPlaying, playContext, toggle } = usePlayer();
  const [query, setQuery] = useState('');
  const { songs, status, error, curate, clear: clearResults } = useCurate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      curate(query, 10);
    }
  };

  return (
    <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop min-h-[calc(100vh-72px)] w-full relative">
      
      <CreateCategoryModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Direct Search Bar */}
      <section className="mb-12">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-primary">
            <span className="material-symbols-outlined text-[24px]">search</span>
          </div>
          <input 
            className="w-full h-14 bg-bg-raised border border-border text-text-primary pl-14 pr-4 rounded-lg focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all font-body text-body-lg placeholder:text-text-tertiary shadow-lg" 
            placeholder="Search for any song or artist directly..." 
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={status === 'curating'}
          />
          {status === 'curating' && (
            <div className="absolute inset-y-0 right-4 flex items-center">
              <span className="material-symbols-outlined animate-spin text-text-tertiary">sync</span>
            </div>
          )}
        </form>

        {error && <div className="mt-4 text-error text-sm bg-error/10 border border-error/20 p-3 rounded">{error}</div>}

        {/* Search Results */}
        {songs.length > 0 && (
          <div className="mt-4 bg-surface-container rounded-lg border border-border p-4 max-h-[350px] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-xs font-bold text-text-secondary uppercase tracking-widest">Search Results</h3>
              <button 
                onClick={() => { setQuery(''); clearResults(); }} 
                className="text-text-tertiary hover:text-error transition-colors font-label text-[10px] uppercase tracking-widest flex items-center gap-1 active:scale-95"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {songs.map((song, i) => {
                const inPlaylist = playlistSongs.some(s => s.id === song.id);
                const isThisPlaying = currentSong?.id === song.id;
                return (
                  <div key={song.id} className="flex items-center gap-4 bg-bg-base p-2 rounded-lg hover:bg-surface-container-high transition-colors border border-transparent hover:border-border-strong group">
                    <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0 cursor-pointer" onClick={() => isThisPlaying ? toggle() : playContext(songs, i)}>
                      <img src={song.albumArt || '/placeholder.png'} className="w-full h-full object-cover" alt="" />
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <span className="material-symbols-outlined text-primary" style={{fontVariationSettings: "'FILL' 1"}}>
                          {isThisPlaying && isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="font-body font-bold text-text-primary truncate">{song.title}</p>
                      <p className="font-body text-xs text-text-secondary truncate">{song.artist}</p>
                    </div>
                    {song.audioUrl ? (
                      <button 
                        onClick={() => !inPlaylist && add(song)}
                        className={`p-2 transition-all active:scale-90 ${inPlaylist ? 'text-primary' : 'text-text-secondary hover:text-primary group-hover:scale-110'}`}
                      >
                        <span className="material-symbols-outlined" style={{fontVariationSettings: inPlaylist ? "'FILL' 1" : "'FILL' 0"}}>
                          {inPlaylist ? 'check_circle' : 'add_circle'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-error text-[10px] uppercase font-bold tracking-widest">Failed</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Category Grid Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-h2 font-semibold text-text-primary flex items-center gap-2">
            <span className="w-1 h-6 bg-primary"></span>
            Library Folders
          </h2>
          <div className="flex gap-4 items-center">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:bg-gold-light text-bg-base font-label text-[10px] uppercase tracking-widest font-bold px-4 py-2 rounded transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              New Category
            </button>
            <div className="flex gap-2 border-l border-border-strong pl-4">
              <button 
                onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-surface-container-highest border-primary text-primary' : 'border-border-strong hover:bg-bg-hover text-text-secondary hover:text-text-primary'}`}
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-surface-container-highest border-primary text-primary' : 'border-border-strong hover:bg-bg-hover text-text-secondary hover:text-text-primary'}`}
              >
                <span className="material-symbols-outlined text-sm">list</span>
              </button>
            </div>
          </div>
        </div>

        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-4"}>
          {sortedFolders.map((folderName, idx) => {
            const titleMatch = folderName.match(/^(\d+)\.\s+(.*)$/);
            const displayNumber = titleMatch ? titleMatch[1].padStart(2, '0') : String(idx + 1).padStart(2, '0');
            const cleanTitle = titleMatch ? titleMatch[2] : folderName;
            const bgImage = FOLDER_IMAGES[cleanTitle];

            if (bgImage && viewMode === 'grid') {
              return (
                <Link 
                  key={folderName}
                  href={`/catalogue/folder/${encodeURIComponent(folderName)}`}
                  className="group relative rounded-xl overflow-hidden block aspect-[4/5] flex flex-col justify-end p-6 border border-border transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl gold-border-glow"
                >
                  {/* Background Image */}
                  <div 
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url('${bgImage}')` }}
                  />
                  {/* Dark Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="relative z-10 w-full flex flex-col gap-4">
                    {/* Tags Row */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-primary text-bg-base font-label text-[10px] uppercase font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                        Trending Now
                      </span>
                      <span className="font-label text-[9px] uppercase tracking-widest text-text-secondary font-bold">
                        {folderStats[folderName]} Categories
                      </span>
                    </div>
                    
                    {/* Title and Description */}
                    <div>
                      <h3 className="font-display text-4xl font-bold text-primary mb-3 leading-tight drop-shadow-md">{cleanTitle}</h3>
                      <p className="font-body text-sm text-text-secondary line-clamp-2">
                        High-energy beats and anthems curated specifically for the ultimate {cleanTitle.toLowerCase()} experience.
                      </p>
                    </div>

                    {/* Action Button */}
                    <div className="flex items-center gap-2 mt-2 group/btn cursor-pointer">
                      <span className="font-label text-[11px] font-bold uppercase tracking-widest text-primary">Explore Collection</span>
                      <span className="material-symbols-outlined text-primary group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                  </div>
                </Link>
              );
            }

            // Fallback for folders without an image, or list view
            return (
              <Link 
                key={folderName}
                href={`/catalogue/folder/${encodeURIComponent(folderName)}`}
                className={`group relative bg-surface-container border border-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl gold-border-glow ${viewMode === 'grid' ? 'p-6 block aspect-[4/5] flex flex-col justify-between' : 'p-4 flex items-center gap-6'}`}
              >
                {viewMode === 'grid' && (
                  <div className="absolute right-0 bottom-[-5%] font-display text-[160px] leading-none font-bold text-primary/5 italic pointer-events-none select-none group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                    {displayNumber}
                  </div>
                )}
                
                <div className={`relative z-10 h-full ${viewMode === 'grid' ? 'flex flex-col' : 'flex flex-row items-center w-full justify-between'}`}>
                  {/* Left side for list view / Top side for grid view */}
                  <div className={viewMode === 'list' ? 'flex items-center gap-6' : ''}>
                    <div className={`font-number text-primary tabular-nums ${viewMode === 'grid' ? 'text-4xl font-bold mb-4' : 'text-2xl font-bold w-12'}`}>
                      {displayNumber}
                    </div>
                    <div>
                      <h3 className={`font-display text-text-primary ${viewMode === 'grid' ? 'text-2xl font-bold mb-1' : 'text-xl'}`}>{cleanTitle}</h3>
                      <p className={`font-body text-sm text-text-secondary ${viewMode === 'grid' ? 'mb-4' : ''}`}>{folderStats[folderName]} Categories</p>
                    </div>
                  </div>

                  {/* Right side for list view / Bottom side for grid view */}
                  <div className={viewMode === 'list' ? 'flex items-center gap-8' : 'mt-auto'}>
                    <div className={`flex flex-wrap gap-2 ${viewMode === 'grid' ? 'mb-6' : ''}`}>
                      <span className="font-label text-[10px] uppercase border border-primary/30 px-3 py-1 rounded-full text-primary">
                        Folder
                      </span>
                    </div>

                    <div className={`flex items-center justify-between transition-colors ${viewMode === 'grid' ? 'pt-4 border-t border-border-strong group-hover:border-primary/40' : ''}`}>
                      {viewMode === 'grid' && <span className="font-label text-[11px] font-semibold uppercase tracking-widest text-text-secondary group-hover:text-primary transition-colors">Open Folder</span>}
                      <div className="w-8 h-8 rounded-full bg-surface-container-highest group-hover:bg-primary flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined text-primary group-hover:text-bg-base text-sm transition-colors">arrow_forward</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
