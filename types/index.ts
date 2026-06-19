export type Song = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  durationMs: number;
  popularity: number;
  previewUrl: string | null;
  audioUrl: string; // Cobalt-resolved, browser-fetchable
  mood?: string;
  year?: number;
  language?: string;
};

export type RawSong = {
  title: string;
  artist: string;
  year?: number;
  mood?: string;
  language?: string;
  bpm_estimate?: number;
};

export type CurateStage =
  | { type: "song"; song: Song }
  | { type: "status"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type PlaylistItem = Song & {
  addedAt: number; // timestamp for ordering
};

export type QueryHistory = {
  id: string;
  query: string;
  songCount: number;
  createdAt: Date;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number }[];
  };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
};
