import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Song } from '@/types';

export type Collection = {
  id: string;
  folder: string;
  title: string;
  count: string;
  tags: string[];
  songs?: Song[];
};

const STRUCTURE: Record<string, string[]> = {
  "1. Bollywood Commercial": ["Trending Bollywood", "Dance Hits", "Party Anthems", "Romantic", "Sad", "Retro Bollywood", "90s Hits", "Punjabi Bollywood", "Item Songs", "Mashups"],
  "2. Punjabi": ["Bhangra", "Wedding Punjabi", "Punjabi Romantic", "Punjabi Party", "AP Dhillon", "Sidhu Moosewala", "Diljit Dosanjh", "Old Punjabi Classics"],
  "3. Wedding Special": ["Baraat Entry", "Bride Entry", "Groom Entry", "Varmala", "Couple Dance", "Vidaai", "Cocktail", "Reception", "Family Performance Songs"],
  "4. Haldi / Mehendi": ["Fun Haldi Songs", "Mehendi Folk", "Rajasthani", "Gujarati Garba", "Dhol Mixes", "Floral Entry Tracks"],
  "5. EDM / Club": ["Commercial EDM", "Slap House", "Techno", "Deep House", "Big Room", "Festival Drops", "Remixes", "After Party"],
  "6. Hip Hop / Rap": ["Indian Rap", "International Hip Hop", "Trap", "Chill Rap", "Party Rap"],
  "7. Retro / Old School": ["Kishore Kumar", "Mohammed Rafi", "Lata Mangeshkar", "Disco 80s", "Retro Remixes"],
  "8. Regional": ["Bengali", "Marathi", "Bhojpuri", "Tamil", "Telugu", "Haryanvi", "Gujarati"],
  "9. Chill / Lounge": ["Cafe Music", "Lo-fi", "Instrumental", "Sunset Vibes", "Soft Acoustic"],
  "10. Corporate Event": ["Background Instrumentals", "Fashion Walk", "Award Show", "Launch Event", "Motivational Tracks"],
  "11. Festival Special": ["Holi", "Diwali", "Navratri", "Ganpati", "Eid", "Christmas", "New Year"],
  "12. Crowd Control / Emergency": ["Hype Songs", "Instant Dance Floor Fillers", "Clean Family Songs", "Kids Dance", "Universal Singalong Songs"],
  "13. DJ Tools": ["Air Horns", "FX", "Risers", "Drops", "MC Intro", "Crowd Chants"],
  "14. Ready Playlists": ["15 Min Warmup", "Peak Hour", "Closing Set", "Wedding Openers", "Late Night Bangers"]
};

const DEFAULT_COLLECTIONS: Collection[] = [];
let idx = 1;
for (const [folder, titles] of Object.entries(STRUCTURE)) {
  for (const title of titles) {
    DEFAULT_COLLECTIONS.push({
      id: idx.toString().padStart(3, '0'),
      folder,
      title,
      count: (Math.floor(Math.random() * 2000) + 100).toString(),
      tags: ['Pro DJ'],
    });
    idx++;
  }
}

export const FOLDERS = Object.keys(STRUCTURE);

type CatalogueStore = {
  collections: Collection[];
  addCollection: (folder: string, title: string, tags: string[]) => void;
  savePlaylistAsCollection: (title: string, songs: Song[]) => void;
  updateCollectionSongs: (id: string, songs: Song[]) => void;
};

export const useCatalogueStore = create<CatalogueStore>()(
  persist(
    (set, get) => ({
      collections: DEFAULT_COLLECTIONS,
      addCollection: (folder, title, tags) => {
        const current = get().collections;
        const newId = (current.length + 1).toString().padStart(3, '0');
        set({
          collections: [
            ...current,
            { id: newId, folder, title, tags, count: '0' }
          ]
        });
      },
      savePlaylistAsCollection: (title, songs) => {
        const current = get().collections;
        const newId = (current.length + 1).toString().padStart(3, '0');
        set({
          collections: [
            ...current,
            { id: newId, folder: 'My Custom Categories', title, tags: ['Custom', 'User'], count: songs.length.toString(), songs }
          ]
        });
      },
      updateCollectionSongs: (id, songs) => {
        const current = get().collections;
        set({
          collections: current.map(c => 
            c.id === id ? { ...c, songs, count: songs.length.toString() } : c
          )
        });
      }
    }),
    { name: 'beatvault-catalogue-v3' }
  )
);

type PlaylistStore = {
  songs: Song[];
  add: (song: Song) => void;
  remove: (id: string) => void;
  clear: () => void;
  reorder: (from: number, to: number) => void;
  totalBytes: () => number;
};

export const usePlaylist = create<PlaylistStore>()(
  persist(
    (set, get) => ({
      songs: [],
      add: (song) => {
        if (!get().songs.find(s => s.id === song.id)) {
          set((state) => ({ songs: [...state.songs, song] }));
        }
      },
      remove: (id) => set((state) => ({ songs: state.songs.filter(s => s.id !== id) })),
      clear: () => set({ songs: [] }),
      reorder: (from, to) => set((state) => {
        const newSongs = [...state.songs];
        const [moved] = newSongs.splice(from, 1);
        newSongs.splice(to, 0, moved);
        return { songs: newSongs };
      }),
      totalBytes: () => {
        return get().songs.reduce((acc, s) => acc + (s.durationMs / 60000) * 1024 * 1024, 0);
      }
    }),
    {
      name: 'eventbros-playlist',
    }
  )
);

type PlayerStore = {
  currentSong: Song | null;
  queue: Song[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'none' | 'all' | 'one';
  showQueue: boolean;

  play: (song: Song) => void;
  playContext: (queue: Song[], startIndex: number) => void;
  pause: () => void;
  toggle: () => void;
  setVolume: (volume: number) => void;
  
  next: () => void;
  prev: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleQueue: () => void;
};

export const usePlayer = create<PlayerStore>((set, get) => ({
  currentSong: null,
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  volume: 1,
  isShuffle: false,
  repeatMode: 'none',
  showQueue: false,

  play: (song) => set({ currentSong: song, isPlaying: true, queue: [song], currentIndex: 0 }),
  
  playContext: (queue, startIndex) => {
    set({
      queue,
      currentIndex: startIndex,
      currentSong: queue[startIndex],
      isPlaying: true,
    });
  },

  pause: () => set({ isPlaying: false }),
  
  toggle: () => {
    const { isPlaying, currentSong } = get();
    if (currentSong) {
      set({ isPlaying: !isPlaying });
    }
  },
  
  setVolume: (volume) => set({ volume }),

  next: () => {
    const state = get();
    if (state.queue.length === 0) return;

    if (state.isShuffle) {
      const nextIndex = Math.floor(Math.random() * state.queue.length);
      set({ currentIndex: nextIndex, currentSong: state.queue[nextIndex], isPlaying: true });
      return;
    }

    let nextIndex = state.currentIndex + 1;
    if (nextIndex >= state.queue.length) {
      if (state.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        // End of queue, don't repeat
        set({ isPlaying: false });
        return;
      }
    }
    
    set({ currentIndex: nextIndex, currentSong: state.queue[nextIndex], isPlaying: true });
  },

  prev: () => {
    const state = get();
    if (state.queue.length === 0) return;

    // Typically, if shuffle is on, prev might still just go to the actual previous index
    // or keep a history stack. For simplicity, we just do currentIndex - 1.
    let prevIndex = state.currentIndex - 1;
    if (prevIndex < 0) {
      if (state.repeatMode === 'all') {
        prevIndex = state.queue.length - 1;
      } else {
        prevIndex = 0; // Just stay at 0
      }
    }
    set({ currentIndex: prevIndex, currentSong: state.queue[prevIndex], isPlaying: true });
  },

  toggleShuffle: () => set((state) => ({ isShuffle: !state.isShuffle })),
  
  toggleRepeat: () => set((state) => {
    const modes: ('none' | 'all' | 'one')[] = ['none', 'all', 'one'];
    const nextIndex = (modes.indexOf(state.repeatMode) + 1) % modes.length;
    return { repeatMode: modes[nextIndex] };
  }),

  toggleQueue: () => set((state) => ({ showQueue: !state.showQueue }))
}));
