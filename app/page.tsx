"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

interface SongRecommendation {
  title: string;
  artist: string;
  searchQuery: string;
}

interface HealthStatus {
  gemini: boolean;
  youtube: boolean;
  ytdlp: boolean;
  ffmpeg: boolean;
}

type AppStep = "idle" | "thinking" | "songs" | "downloading" | "done";

const EXAMPLE_PROMPTS = [
  "🎸 Top 5 classic rock anthems of the 80s",
  "🎧 Chill lo-fi beats for studying",
  "💃 Best Bollywood dance songs 2023",
  "🌊 Sad indie songs for rainy days",
  "🔥 High-energy gym workout tracks",
  "🎷 Smooth jazz for late night vibes",
];

const STEPS = [
  { id: "thinking", label: "AI Thinking", icon: "✦" },
  { id: "searching", label: "Finding Songs", icon: "⌕" },
  { id: "downloading", label: "Downloading", icon: "↓" },
  { id: "zipping", label: "Packaging", icon: "◈" },
];

export default function HomePage() {
  const [prompt, setPrompt] = useState("");
  const [songCount, setSongCount] = useState(5);
  const [inputValue, setInputValue] = useState("5");
  const [step, setStep] = useState<AppStep>("idle");
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [songs, setSongs] = useState<SongRecommendation[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [downloadComplete, setDownloadComplete] = useState(false);

  useEffect(() => {
    setInputValue(songCount.toString());
  }, [songCount]);

  // Check prerequisites on mount
  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const toggleSong = useCallback((idx: number) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSongs(new Set(songs.map((_, i) => i)));
  }, [songs]);

  const handleCountChange = (valStr: string) => {
    setInputValue(valStr);
    const num = parseInt(valStr, 10);
    if (!isNaN(num)) {
      setSongCount(Math.min(Math.max(num, 1), 30));
    }
  };

  const handleCountBlur = () => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num)) {
      setSongCount(5);
      setInputValue("5");
    } else {
      const clamped = Math.min(Math.max(num, 1), 30);
      setSongCount(clamped);
      setInputValue(clamped.toString());
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setError(null);
    setStep("thinking");
    setCurrentStepIdx(0);
    setSongs([]);
    setSelectedSongs(new Set());
    setDownloadComplete(false);
    setStatusMsg("Gemini is curating your perfect playlist…");

    try {
      // Step 1: Get recommendations from Gemini
      const recRes = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), count: songCount }),
      });

      const recData = await recRes.json();

      if (!recRes.ok) {
        throw new Error(recData.error || "Failed to get recommendations");
      }

      const fetchedSongs: SongRecommendation[] = recData.songs;
      setSongs(fetchedSongs);
      setSelectedSongs(new Set(fetchedSongs.map((_: SongRecommendation, i: number) => i)));
      setCurrentStepIdx(1);
      setStep("songs");
      setStatusMsg(`Found ${fetchedSongs.length} songs! Select which ones to download.`);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
      setStep("idle");
      setCurrentStepIdx(-1);
    }
  };

  const handleDownload = async () => {
    if (selectedSongs.size === 0) return;

    setError(null);
    setStep("downloading");
    setCurrentStepIdx(2);
    setStatusMsg("Searching YouTube for each song…");
    setDownloadComplete(false);

    const songsToDownload = songs.filter((_, i) => selectedSongs.has(i));

    try {
      setStatusMsg(
        `Downloading ${songsToDownload.length} songs and converting to MP3… This may take a few minutes.`
      );
      setCurrentStepIdx(2);

      const dlRes = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: songsToDownload }),
      });

      if (!dlRes.ok) {
        const errData = await dlRes.json();
        throw new Error(errData.error || "Download failed");
      }

      setCurrentStepIdx(3);
      setStatusMsg("Packaging songs into a ZIP file…");

      // Get the blob
      const blob = await dlRes.blob();
      const downloaded = Number(dlRes.headers.get("X-Songs-Downloaded") || songsToDownload.length);

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MusicNowEasy-${downloaded}-songs.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep("done");
      setCurrentStepIdx(4);
      setDownloadComplete(true);
      setStatusMsg(`✓ ${downloaded} song${downloaded !== 1 ? "s" : ""} downloaded successfully!`);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
      setStep("songs");
      setCurrentStepIdx(1);
    }
  };

  const handleReset = () => {
    setStep("idle");
    setCurrentStepIdx(-1);
    setSongs([]);
    setSelectedSongs(new Set());
    setError(null);
    setStatusMsg("");
    setDownloadComplete(false);
    setPrompt("");
  };

  const isLoading = step === "thinking" || step === "downloading";
  const progressWidth =
    currentStepIdx < 0
      ? "0%"
      : currentStepIdx === 0
      ? "10%"
      : currentStepIdx === 1
      ? "40%"
      : currentStepIdx === 2
      ? "70%"
      : currentStepIdx === 3
      ? "90%"
      : "100%";

  return (
    <>
      {/* Animated Background */}
      <div className="app-bg">
        <div className="app-bg-orb" />
      </div>
      <div className="grid-overlay" />

      <main className="main-container">
        {/* Hero */}
        <header className="hero">
          <Image
            src="/logo.png"
            alt="MusicNowEasy logo"
            width={72}
            height={72}
            className="hero-logo"
            priority
          />
          <div className="hero-badge">
            <span>✦</span> Powered by Gemini AI
          </div>
          <h1 className="hero-title">MusicNowEasy</h1>
          <p className="hero-subtitle">
            Describe the music you love. AI finds it. You download it — as MP3s,
            neatly zipped.
          </p>
        </header>

        {/* Prerequisites Status */}
        {health && (!health.ytdlp || !health.ffmpeg || !health.gemini || !health.youtube) && (
          <div className="prereq-section">
            <div className="prereq-card">
              <div className="prereq-title">⚠ Setup Required</div>
              <div className="prereq-items">
                <span className={`prereq-item ${health.gemini ? "ok" : "missing"}`}>
                  {health.gemini ? "✓" : "✗"} Gemini API
                </span>
                <span className={`prereq-item ${health.youtube ? "ok" : "missing"}`}>
                  {health.youtube ? "✓" : "✗"} YouTube API
                </span>
                <span className={`prereq-item ${health.ytdlp ? "ok" : "missing"}`}>
                  {health.ytdlp ? "✓" : "✗"} yt-dlp
                </span>
                <span className={`prereq-item ${health.ffmpeg ? "ok" : "missing"}`}>
                  {health.ffmpeg ? "✓" : "✗"} ffmpeg
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="status-banner error">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Success Banner */}
        {downloadComplete && (
          <div className="status-banner success">
            <span>✓</span> {statusMsg}
          </div>
        )}

        {/* Main Card */}
        <div className="main-card">
          {/* Example Prompts */}
          <div>
            <span className="chip-label">Try an example</span>
            <div className="example-chips">
              {EXAMPLE_PROMPTS.map((ex) => (
                <button
                  key={ex}
                  className="example-chip"
                  onClick={() => setPrompt(ex.replace(/^.{2}/, "").trim())}
                  disabled={isLoading}
                  type="button"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          <div className="divider" />

          {/* Prompt Input */}
          <div className="prompt-label">
            <span className="prompt-label-icon">✦</span>
            What music are you looking for?
          </div>
          <textarea
            id="music-prompt"
            className="prompt-textarea"
            placeholder="e.g. Top 5 sad Hindi love songs perfect for a rainy evening drive…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            maxLength={500}
            rows={4}
          />
          <div className="prompt-footer">
            <span className={`char-count ${prompt.length > 450 ? "over" : ""}`}>
              {prompt.length}/500
            </span>
          </div>

          <div className="divider" />

          {/* Song Count Selector */}
          <div className="count-row-new">
            <div className="count-header">
              <label htmlFor="song-count-input" className="count-label">
                🎵 Number of songs
              </label>
            </div>
            
            <div className="count-controls">
              {/* Presets */}
              <div className="preset-buttons">
                {[5, 10, 15, 20].map((num) => (
                  <button
                    key={num}
                    id={`preset-btn-${num}`}
                    type="button"
                    className={`preset-btn ${songCount === num ? "active" : ""}`}
                    onClick={() => !isLoading && setSongCount(num)}
                    disabled={isLoading}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Custom numeric stepper */}
              <div className="custom-stepper">
                <button
                  id="stepper-dec-btn"
                  type="button"
                  className="stepper-btn"
                  onClick={() => !isLoading && setSongCount(prev => Math.max(1, prev - 1))}
                  disabled={isLoading || songCount <= 1}
                  aria-label="Decrease song count"
                >
                  −
                </button>
                <input
                  id="song-count-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputValue}
                  onChange={(e) => handleCountChange(e.target.value)}
                  onBlur={handleCountBlur}
                  className="stepper-input"
                  disabled={isLoading}
                />
                <button
                  id="stepper-inc-btn"
                  type="button"
                  className="stepper-btn"
                  onClick={() => !isLoading && setSongCount(prev => Math.min(30, prev + 1))}
                  disabled={isLoading || songCount >= 30}
                  aria-label="Increase song count"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            id="generate-btn"
            className={`cta-button ${isLoading ? "loading" : ""}`}
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            type="button"
          >
            {step === "thinking" ? (
              <>
                <div className="spinner" />
                AI is thinking…
              </>
            ) : (
              <>
                ✦ Generate Playlist
              </>
            )}
          </button>
        </div>

        {/* Progress Steps */}
        {(step !== "idle" || songs.length > 0) && (
          <div className="progress-section">
            <div className="progress-steps">
              <div
                className="progress-line"
                style={{ width: progressWidth }}
              />
              {STEPS.map((s, idx) => {
                const isDone = currentStepIdx > idx;
                const isActive = currentStepIdx === idx;
                return (
                  <div key={s.id} className="progress-step">
                    <div
                      className={`step-dot ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                    >
                      {isDone ? "✓" : s.icon}
                    </div>
                    <span
                      className={`step-label ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {statusMsg && !error && !downloadComplete && (
              <p style={{ textAlign: "center", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                {statusMsg}
              </p>
            )}
          </div>
        )}

        {/* Song Cards */}
        {songs.length > 0 && (
          <div className="songs-section">
            <div className="songs-header">
              <div className="songs-title">🎵 Your Playlist</div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <button
                  onClick={selectAll}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    color: "var(--accent-purple-light)",
                    padding: "3px 8px",
                  }}
                  type="button"
                >
                  Select All
                </button>
                <span className="songs-count-badge">{songs.length} songs</span>
              </div>
            </div>

            <div className="songs-grid">
              {songs.map((song, idx) => (
                <div
                  key={`${song.title}-${idx}`}
                  className={`song-card ${selectedSongs.has(idx) ? "selected" : ""}`}
                  onClick={() => toggleSong(idx)}
                  style={{ animationDelay: `${idx * 0.06}s` }}
                  role="checkbox"
                  aria-checked={selectedSongs.has(idx)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === " " && toggleSong(idx)}
                >
                  <div className="song-number">{idx + 1}</div>
                  <div className="song-info">
                    <div className="song-title">{song.title}</div>
                    <div className="song-artist">{song.artist}</div>
                  </div>
                  <div className="song-check">
                    {selectedSongs.has(idx) ? "✓" : ""}
                  </div>
                </div>
              ))}
            </div>

            {/* Download Section */}
            <div className="download-section">
              <div className="download-info">
                <span className="selected-info">
                  <strong>{selectedSongs.size}</strong> of {songs.length} songs
                  selected
                </span>
                <button
                  onClick={handleReset}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    color: "var(--text-muted)",
                    padding: "3px 8px",
                  }}
                  type="button"
                >
                  ↺ Start Over
                </button>
              </div>

              <button
                id="download-zip-btn"
                className={`download-btn ${step === "downloading" ? "loading" : ""}`}
                onClick={handleDownload}
                disabled={selectedSongs.size === 0 || step === "downloading"}
                type="button"
              >
                {step === "downloading" ? (
                  <>
                    <div className="spinner" />
                    Downloading {selectedSongs.size} songs…
                  </>
                ) : downloadComplete ? (
                  <>✓ Download Again</>
                ) : (
                  <>◈ Download ZIP ({selectedSongs.size} MP3s)</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>
            Built with ♪ using Next.js · Gemini AI · YouTube Data API · yt-dlp
          </p>
          <p style={{ marginTop: "4px" }}>
            For personal use only · Respect copyright laws
          </p>
        </footer>
      </main>
    </>
  );
}
