# Jainny The DJ 🎧

A powerful, AI-driven desktop application built for professional DJs and music enthusiasts. **Jainny The DJ** allows you to instantly generate smart, curated playlists, stream tracks dynamically, and manage your music catalogue seamlessly—all within a beautiful, standalone Windows desktop application.

---

## ✨ Features

- **🤖 AI Smart Curation:** Uses advanced AI (Groq API) to instantly auto-generate 20+ track playlists tailored to specific themes, events, or vibes (e.g., "Wedding Special", "EDM Club Hits").
- **🚀 High-Speed Spotify Downloader:** Download complete Spotify playlists at maximum bandwidth! Bypasses YouTube's CDN stream throttling using HTTP Range chunking, directly downloading tracks at 10-50 MB/s.
- **📂 Interactive Catalogue:** A robust, folder-based homepage allowing easy navigation through pre-built music collections.
- **🎵 Built-in Audio Player:** Stream your generated playlists directly inside the application with an integrated, sleek audio player.
- **⚡ Next.js + Electron Power:** Built with the bleeding-edge Next.js 16 App Router (Turbopack) wrapped flawlessly in Electron for a lightning-fast native desktop experience.
- **🎨 Premium UI/UX:** A stunning dark-mode interface with glassmorphism, dynamic gradients, and a beautiful animated splash screen.
- **💽 Native Windows Installer:** A completely automated pipeline (`fix-symlinks.js`) that safely bundles native modules (like Prisma) into a portable, standalone `.exe` without EPERM errors.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 16 (App Router, Standalone Output)
- **Desktop Wrapper:** Electron & Electron-Builder
- **Styling:** Tailwind CSS
- **Database:** Prisma ORM
- **AI Integration:** Groq API & Gemini API
- **Music APIs:** Spotify API & Cobalt

---

## 🚀 How to Run Locally

### 1. Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v20+ recommended)
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/WhoHarsh-14/MusicNowEasy.git
cd MusicNowEasy
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Download yt-dlp Binary
Because `yt-dlp.exe` is a large binary file, it is excluded from GitHub (`.gitignore`). You must manually download it for the audio streaming to work:
1. Go to the [yt-dlp GitHub Releases page](https://github.com/yt-dlp/yt-dlp/releases).
2. Download `yt-dlp.exe`.
3. Place `yt-dlp.exe` directly into the root directory of this project (`MusicNowEasy/yt-dlp.exe`).

### 5. Setup Environment Variables
Create a `.env` file in the root of your project and configure the following keys:
```env
GROQ_API_KEY=your_groq_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
DATABASE_URL=your_prisma_database_url
COBALT_URL=your_cobalt_url
```

### 6. Run in Development Mode
To start the Next.js development server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

---

## 📦 Building for Production (Windows `.exe`)

To compile the application into a standalone Windows Desktop installer, run the following command:

```bash
npm run build:desktop
```

### What this command does:
1. Clears the old `dist` folder.
2. Compiles the Next.js app in `standalone` mode.
3. Runs a custom `postbuild` script (`fix-symlinks.js`) to replace fragile symlinks with hard copies, ensuring Prisma client native binaries work flawlessly on Windows.
4. Uses `electron-builder` to package everything into a highly optimized Windows installer.

Once the build is complete, you will find your standalone application installer inside the **`dist/`** directory!
