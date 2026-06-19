"use client";

import { useState, use } from 'react';
import Link from 'next/link';
import { useCatalogueStore } from '@/lib/store';

export default function FolderPage({ params }: { params: Promise<{ folderName: string }> }) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const resolvedParams = use(params);
  const folderName = decodeURIComponent(resolvedParams.folderName);
  
  // Extract all collections first, then filter, to avoid returning a new array reference from the Zustand selector
  const allCollections = useCatalogueStore(state => state.collections);
  const collections = allCollections.filter(c => c.folder === folderName);

  return (
    <main className="pt-24 pb-20 px-margin-mobile md:px-margin-desktop min-h-[calc(100vh-72px)] w-full relative">
      <div className="mb-6">
        <Link href="/" className="text-text-secondary hover:text-text-primary flex items-center gap-2 font-label text-[10px] uppercase tracking-widest font-bold w-fit transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Folders
        </Link>
      </div>

      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-4xl font-semibold text-primary flex items-center gap-3">
            <span className="material-symbols-outlined text-[32px]">folder_open</span>
            {folderName}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setViewMode('grid')}
              className={`w-10 h-10 rounded border flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-surface-container-highest border-primary text-primary' : 'border-border-strong hover:bg-bg-hover text-text-secondary hover:text-text-primary'}`}
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`w-10 h-10 rounded border flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-surface-container-highest border-primary text-primary' : 'border-border-strong hover:bg-bg-hover text-text-secondary hover:text-text-primary'}`}
            >
              <span className="material-symbols-outlined text-base">list</span>
            </button>
          </div>
        </div>

        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
          {collections.map((collection) => (
            <Link 
              key={collection.id}
              href={`/catalogue/${collection.id}`}
              className={`group relative bg-surface-container border border-border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl gold-border-glow ${viewMode === 'grid' ? 'p-6 block aspect-[4/3] flex flex-col justify-between' : 'p-4 flex items-center gap-6'}`}
            >
              {viewMode === 'grid' && (
                <div className="absolute right-0 bottom-[-5%] font-display text-[160px] leading-none font-bold text-primary/5 italic pointer-events-none select-none group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                  {collection.id}
                </div>
              )}
              
              <div className={`relative z-10 h-full ${viewMode === 'grid' ? 'flex flex-col' : 'flex flex-row items-center w-full justify-between'}`}>
                {/* Top/Left side */}
                <div className={viewMode === 'list' ? 'flex items-center gap-6' : ''}>
                  <div className={`font-number text-primary tabular-nums ${viewMode === 'grid' ? 'text-4xl font-bold mb-4' : 'text-2xl font-bold w-12'}`}>{collection.id}</div>
                  <div>
                    <h3 className={`font-display text-text-primary ${viewMode === 'grid' ? 'text-2xl font-bold mb-1' : 'text-xl'}`}>{collection.title}</h3>
                    <p className={`font-body text-sm text-text-secondary ${viewMode === 'grid' ? 'mb-4' : ''}`}>{collection.count} Songs</p>
                  </div>
                </div>

                {/* Bottom/Right side */}
                <div className={viewMode === 'list' ? 'flex items-center gap-8' : 'mt-auto'}>
                  <div className={`flex flex-wrap gap-2 ${viewMode === 'grid' ? 'mb-6' : ''}`}>
                    {collection.tags.map(tag => (
                      <span key={tag} className="font-label text-[10px] uppercase border border-primary/30 px-3 py-1 rounded-full text-primary">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className={`flex items-center justify-between transition-colors ${viewMode === 'grid' ? 'pt-4 border-t border-border-strong group-hover:border-primary/40' : ''}`}>
                    {viewMode === 'grid' && <span className="font-label text-[11px] font-semibold uppercase tracking-widest text-text-secondary group-hover:text-primary transition-colors">Browse Tracks</span>}
                    <div className="w-8 h-8 rounded-full bg-surface-container-highest group-hover:bg-primary flex items-center justify-center transition-colors">
                      <span className="material-symbols-outlined text-primary group-hover:text-bg-base text-sm transition-colors">arrow_forward</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {collections.length === 0 && (
          <div className="text-center py-20 text-text-secondary font-body">
            No categories found in this folder.
          </div>
        )}
      </section>
    </main>
  );
}
