"use client";

import { useState } from 'react';
import { useCatalogueStore, FOLDERS } from '@/lib/store';

type CreateCategoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function CreateCategoryModal({ isOpen, onClose }: CreateCategoryModalProps) {
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('My Custom Categories');
  const [tagsInput, setTagsInput] = useState('');
  const addCollection = useCatalogueStore(state => state.addCollection);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    addCollection(folder, title, tags);
    setTitle('');
    setFolder('My Custom Categories');
    setTagsInput('');
    onClose();
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-surface-container-highest border border-border-strong rounded-xl shadow-2xl z-[101] overflow-hidden">
        <div className="p-6 border-b border-border-strong flex justify-between items-center bg-surface-container-lowest">
          <h2 className="font-display text-h3 font-bold text-primary">New Category</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block font-label text-[10px] uppercase tracking-widest text-text-secondary mb-2">Category Name</label>
            <input 
              type="text" 
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Afrobeat Essentials"
              className="w-full bg-surface-container-lowest border border-border focus:border-primary rounded px-4 py-3 text-text-primary font-body focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block font-label text-[10px] uppercase tracking-widest text-text-secondary mb-2">Main Folder</label>
            <div className="relative">
              <select 
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full bg-surface-container-lowest border border-border focus:border-primary rounded px-4 py-3 text-text-primary font-body focus:outline-none transition-colors appearance-none"
              >
                <option value="My Custom Categories">My Custom Categories</option>
                {FOLDERS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-text-secondary">expand_more</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-label text-[10px] uppercase tracking-widest text-text-secondary mb-2">Tags (Comma Separated)</label>
            <input 
              type="text" 
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Vibes, Lounge, Sunset"
              className="w-full bg-surface-container-lowest border border-border focus:border-primary rounded px-4 py-3 text-text-primary font-body focus:outline-none transition-colors"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border-strong">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!title.trim()}
              className="px-6 py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest bg-primary text-bg-base hover:bg-gold-light disabled:opacity-50 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
