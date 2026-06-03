# 🎵 MusicNowEasy

> AI-Powered Song Downloader — Describe the music you want, and get a ZIP of MP3s.

Built with **Next.js 15**, **Gemini AI**, **YouTube Data API v3**, and **yt-dlp**.

---

## ✨ Features

- 🤖 **AI-curated playlists** — Describe any mood, genre, era, or vibe in plain text
- 🔍 **YouTube-powered search** — Finds the best video for each song automatically
- 🎵 **MP3 conversion** — Downloads audio and converts to high-quality MP3 via ffmpeg
- 📦 **ZIP download** — All songs bundled into a single ZIP file
- ✅ **Song selection** — Pick which songs from the AI's list to include
- 🌑 **Dark neon UI** — Glassmorphism design with purple/cyan glow effects

---

## 🛠️ Prerequisites

You need **4 things** before the app works end-to-end:

### 1. Node.js 18+
Download from [nodejs.org](https://nodejs.org)

### 2. yt-dlp (CLI tool)
```powershell
winget install yt-dlp.yt-dlp
```
Or download the `.exe` from [github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases) and add it to your PATH.

### 3. ffmpeg (for MP3 conversion)
```powershell
winget install Gyan.FFmpeg
```
Or download from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) and add the `bin/` folder to your PATH.

**Verify installation:**
```powershell
yt-dlp --version
ffmpeg -version
```

### 4. API Keys

#### Gemini API Key (Free)
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API key"**
3. Copy the key

#### YouTube Data API v3 Key (Free — 10,000 units/day)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project (or select existing)
3. Go to **APIs & Services** → **Library**
4. Search for **"YouTube Data API v3"** and click **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **"Create Credentials"** → **API Key**
7. Copy the key

---

## 🚀 Setup & Run

```bash
# 1. Clone / navigate to the project
cd MusicNowEasy/musicnoweasy

# 2. Install dependencies
npm install

# 3. Add your API keys
# Edit .env.local and replace the placeholder values:
notepad .env.local
```

**.env.local:**
```
GEMINI_API_KEY=AIza...your_actual_key
YOUTUBE_API_KEY=AIza...your_actual_key
```

```bash
# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
musicnoweasy/
├── app/
│   ├── api/
│   │   ├── recommend/route.ts   # Gemini song recommendations
│   │   ├── download/route.ts    # YouTube search + yt-dlp download + ZIP
│   │   └── health/route.ts      # Prerequisites check
│   ├── globals.css              # Dark neon theme
│   ├── layout.tsx               # Root layout + SEO
│   └── page.tsx                 # Main UI
├── lib/
│   ├── gemini.ts                # Gemini API wrapper
│   ├── youtube.ts               # YouTube Data API wrapper
│   ├── downloader.ts            # yt-dlp child process runner
│   └── zipper.ts                # archiver ZIP creator
├── public/
│   └── logo.png                 # App logo
└── .env.local                   # Your API keys (never commit this!)
```

---

## ⚠️ Important Notes

- **Personal use only** — Downloading copyrighted content may violate YouTube's ToS
- **Download speed** — Each song takes 30–90 seconds to download and convert
- **YouTube quota** — The free API gives 10,000 units/day (roughly 100 searches)
- **Keep yt-dlp updated** — Run `yt-dlp -U` periodically to avoid broken downloads

---

## 🔧 Troubleshooting

| Issue | Fix |
|---|---|
| `yt-dlp not found` | Add yt-dlp to your system PATH |
| `ffmpeg not found` | Add ffmpeg bin/ folder to your system PATH |
| `GEMINI_API_KEY not configured` | Add key to `.env.local` and restart server |
| `YOUTUBE_API_KEY not configured` | Add key to `.env.local` and restart server |
| Download fails | Run `yt-dlp -U` to update, then retry |
| ZIP is empty | Check server logs — one or more songs may have failed |

---

*Made with ♪ by MusicNowEasy*
