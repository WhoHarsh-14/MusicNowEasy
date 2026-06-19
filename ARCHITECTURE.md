# MusicNowEasy — Current Architecture

> **Last Updated:** June 2026  
> **Status:** Working · Local Dev  
> **Version:** 0.1.0

---

## 1. Overview

MusicNowEasy is a **zero-infrastructure, browser-streamed** DJ song curation platform. The user describes a vibe in natural language, the system generates a playlist via AI, enriches it with Spotify metadata, resolves audio via SoundCloud, and packages it as a ZIP directly on the user's disk — all without any server-side file I/O.

### Core Principles
- **No server storage** — audio bytes flow directly from SoundCloud → user disk
- **SSE streaming** — songs appear on the UI one-by-one as they resolve
- **Database caching** — repeated queries are served instantly from Supabase
- **Browser-side ZIP** — all packaging done in the browser using `fflate` + `StreamSaver`

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js | 16.2.7 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Animation** | Framer Motion | 12.x |
| **State Management** | Zustand (with persist) | 5.x |
| **AI / LLM** | Google Gemini 3.5 Flash | via `@google/generative-ai` |
| **Metadata** | Spotify Web API | Client Credentials Flow |
| **Audio Resolution** | SoundCloud | via `soundcloud-downloader` |
| **ZIP Generation** | fflate | 0.8.x |
| **File Streaming** | StreamSaver.js | 2.x |
| **Database ORM** | Prisma | 7.x (with PrismaPg adapter) |
| **Database** | Supabase (Postgres) | via connection pooler |
| **Runtime** | Node.js | 24.x |

---

## 3. Directory Structure

```
MusicNowEasy/
├── app/
│   ├── api/
│   │   ├── curate/route.ts       # SSE streaming endpoint (main orchestrator)
│   │   ├── stream/route.ts       # Server-side SoundCloud audio proxy
│   │   ├── spotify-token/route.ts # Spotify token endpoint (unused by UI directly)
│   │   └── proxy/                # Legacy — kept but unused
│   ├── layout.tsx                # Root layout with Playlist Tray
│   ├── page.tsx                  # Main search UI
│   └── globals.css               # Tailwind base + design tokens
│
├── lib/
│   ├── gemini.ts                 # Gemini streaming + JSON parser
│   ├── spotify.ts                # Spotify token cache + track search
│   ├── cobalt.ts                 # SoundCloud search + URL resolution
│   ├── db.ts                     # PrismaClient singleton (PrismaPg adapter)
│   ├── download.ts               # Browser-side ZIP streaming (fflate + StreamSaver)
│   ├── store.ts                  # Zustand playlist store (persisted to localStorage)
│   └── prewarm.ts                # (unused) DB prewarm utility
│
├── hooks/
│   └── useCurate.ts              # React hook: opens EventSource, manages state
│
├── types/
│   └── index.ts                  # Shared TypeScript types
│
├── prisma/
│   └── schema.prisma             # QueryHistory model (PostgreSQL)
│
├── .env.local                    # Local secrets (GEMINI, SPOTIFY, DATABASE_URL)
└── next.config.ts                # Spotify image domains, CORS headers
```

---

## 4. Request Flow (End-to-End)

```
User types query → [page.tsx]
        │
        ▼
useCurate hook opens EventSource:  GET /api/curate?q=...&n=...
        │
        ▼
[app/api/curate/route.ts] — Server-Sent Events (SSE)
        │
        ├─ 1. CHECK CACHE ──────────────────────────────────────────────────┐
        │     SELECT * FROM query_history WHERE query = ... (Supabase)      │
        │     If fresh (<24h): replay cached songs as SSE → DONE            │
        │                                                                    │
        ├─ 2. GEMINI STREAM (lib/gemini.ts)                                 │
        │     POST → Gemini 3.5 Flash                                        │
        │     Model generates JSON array of { title, artist } objects        │
        │     Streamed chunk-by-chunk via bracket-matching parser             │
        │     Each RawSong is yielded as soon as the closing } is seen       │
        │                                                                    │
        ├─ 3. PARALLEL ENRICHMENT (per song, all run concurrently)          │
        │     ├─ Spotify Search (lib/spotify.ts)                             │
        │     │   GET /v1/search?q=track:{title}+artist:{artist}             │
        │     │   Returns: albumArt, durationMs, popularity, previewUrl      │
        │     │                                                               │
        │     └─ SoundCloud Resolve (lib/cobalt.ts)                          │
        │         scdl.search({ query: "title artist" })                     │
        │         Returns: /api/stream?id={soundcloud_permalink_url}         │
        │                                                                    │
        ├─ 4. SSE EMIT                                                       │
        │     data: { type: "song", song: {...} }                            │
        │     → Received by useCurate hook                                   │
        │     → setSongs(prev => [...prev, song])                            │
        │     → UI card animates in                                          │
        │                                                                    │
        ├─ 5. DONE                                                           │
        │     data: { type: "done" }                                         │
        │     → SSE connection closed                                        │
        │                                                                    │
        └─ 6. CACHE WRITE (background, non-blocking)                        │
              INSERT INTO query_history (query, songs_json) VALUES (...)  ◄─┘
```

---

## 5. Audio Streaming Flow

```
Browser clicks "Download All"
        │
        ▼
[lib/download.ts] — downloadPlaylist()
        │
        ├─ Opens StreamSaver write stream → direct to user's disk (no RAM buffering)
        │
        ├─ Creates fflate Zip stream (ZipPassThrough for no compression = speed)
        │
        └─ For each song (batched 6 at a time):
              fetch(song.audioUrl)    →    GET /api/stream?id={soundcloud_url}
                                                  │
                                                  ▼
                                       [app/api/stream/route.ts]
                                       scdl.download(soundcloud_url)
                                       Pipes Node.js Readable → Web ReadableStream
                                       Content-Type: audio/mpeg
                                                  │
                                                  ▼
                                       Browser receives audio bytes
                                       → piped into ZIP entry
                                       → piped to disk via StreamSaver
```

---

## 6. Key Modules

### `lib/gemini.ts`
- Uses `@google/generative-ai` SDK
- Model: `gemini-3.5-flash`
- Streams the response chunk-by-chunk
- Custom bracket-matching `extractJSONObjects()` parser safely extracts valid JSON objects from mid-stream text
- `yield`s each `RawSong` as soon as it is fully parsed — enabling parallel downstream processing

### `lib/cobalt.ts`
- Uses `soundcloud-downloader` (`scdl`)
- Searches SoundCloud for `"{title} {artist}"`
- Returns `/api/stream?id={permalink_url}` — never a raw SoundCloud URL (SoundCloud rejects direct browser fetches without CORS)

### `app/api/stream/route.ts`
- Accepts `?id={soundcloud_permalink_url}`
- Calls `scdl.download(id)` server-side
- Converts Node.js `Readable` stream into a Web `ReadableStream`
- Adds `Access-Control-Allow-Origin: *` header so the browser can fetch it

### `lib/db.ts`
- Prisma 7 with `PrismaPg` driver adapter (required — Prisma 7 removed its built-in Rust query engine)
- Uses a `pg.Pool` connected to Supabase's connection pooler URL
- Singleton pattern with `globalThis` to prevent multiple connections in dev hot-reload

### `lib/store.ts`
- Zustand store with `persist` middleware
- Saved to `localStorage` under key `eventbros-playlist`
- Methods: `add`, `remove`, `clear`, `reorder`, `totalBytes`

---

## 7. Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key for Gemini 3.5 Flash |
| `SPOTIFY_CLIENT_ID` | Spotify app Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app Client Secret |
| `DATABASE_URL` | Supabase Postgres connection pooler string (pgbouncer mode) |

---

## 8. Database Schema

```sql
-- Supabase / PostgreSQL

CREATE TABLE query_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query       TEXT        NOT NULL,
  song_count  INT         NOT NULL,
  songs_json  JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Cache TTL:** 24 hours — queries older than 24h are ignored and re-generated fresh.

---

## 9. Known Limitations & Bottlenecks

| Issue | Root Cause | Severity |
|---|---|---|
| **Generation time scales with song count** | LLM generates text token-by-token; 20 songs takes ~2x time of 10 songs | High |
| **SoundCloud match quality** | `scdl.search()` may find a different version of a song than intended | Medium |
| **Gemini rate limit (free tier)** | Free tier has low RPM/RPD limits; bursting triggers 429 errors | Medium |
| **StreamSaver Safari support** | StreamSaver has limited support in Safari (no `WritableStream`) | Low |
| **Unused packages** | `@distube/ytdl-core`, `youtube-sr`, `youtubei.js` still in `package.json` but are no longer used | Low |

---

## 10. Performance Characteristics

| Operation | Time |
|---|---|
| Cache hit (already searched query) | ~300ms |
| Gemini generates 10 songs | ~5–8s |
| Gemini generates 20 songs | ~10–16s |
| Spotify track search (per song) | ~200ms (runs in parallel) |
| SoundCloud resolve (per song) | ~300ms (runs in parallel) |
| First song visible on UI | ~3–5s after search |

---

## 11. Deployment Notes

- **Platform:** Vercel (Hobby tier compatible)
- **Function runtime:** `nodejs` (not edge) — required for `soundcloud-downloader` and Prisma
- **Max function duration:** 60s (configured via `export const maxDuration = 60`)
- **Bandwidth:** Near-zero on Vercel — audio flows `SoundCloud → /api/stream → Browser → Disk`, not stored on Vercel
- **Build:** Standard `next build` — no binary dependencies (Python, ffmpeg, yt-dlp removed)
