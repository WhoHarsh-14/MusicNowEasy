"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type AppStep = "idle" | "quiz" | "thinking" | "songs" | "downloading" | "done";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLES = [
  "🎸 80s classic rock anthems",
  "🎧 Lo-fi beats for studying",
  "💃 Bollywood dance hits 2024",
  "🌧 Sad indie songs, rainy days",
  "🔥 High-energy gym tracks",
  "🎷 Late-night smooth jazz",
];

const PROG_STEPS = [
  { label: "AI Thinking",  icon: "✦" },
  { label: "Finding Songs", icon: "⌕" },
  { label: "Downloading",  icon: "↓" },
  { label: "Packaging",    icon: "◈" },
];

interface QuizStepCfg {
  key: "type" | "vibe" | "trend" | "theme" | "base";
  title: string;
  question: string;
  options: string[];
  placeholder: string;
}

const QUIZ_STEPS: QuizStepCfg[] = [
  {
    key: "type",
    title: "Song Type",
    question: "What style or genre are you after?",
    options: ["🎸 Rock / Metal", "🎵 Pop / Synthpop", "🎧 EDM / Dance", "🎤 Hip-Hop / Rap",
               "🎹 R&B / Soul", "🍃 Acoustic / Folk", "🎻 Classical / Ambient", "🎬 Bollywood / Indian"],
    placeholder: "Custom genre (e.g. Lo-Fi, Synthwave, K-pop)…",
  },
  {
    key: "vibe",
    title: "Vibe / Mood",
    question: "What mood should the playlist set?",
    options: ["☕ Chill & Mellow", "⚡ Energetic & Hype", "🌧 Sad & Emotional", "🌌 Dark & Moody",
               "☀️ Uplifting & Happy", "❤️ Romantic & Sweet"],
    placeholder: "Custom vibe (e.g. Ethereal, Aggressive, Nostalgic)…",
  },
  {
    key: "trend",
    title: "Trend / Era",
    question: "Which era or popularity tier?",
    options: ["📈 Hot & Viral (Trending)", "📀 Timeless Classics", "📼 80s / 90s Throwbacks",
               "💎 Underground Gems", "🆕 Fresh New Releases"],
    placeholder: "Custom era (e.g. Early 2000s Pop, Y2K)…",
  },
  {
    key: "theme",
    title: "Theme / Setting",
    question: "What's the setting for this music?",
    options: ["🚗 Late Night Drive", "🏋️ Workout & Gym", "📚 Study & Focus",
               "☕ Rainy Day Café", "🪩 Party & Dance", "🌅 Sunset Beach"],
    placeholder: "Custom theme (e.g. Gaming session, Road trip)…",
  },
  {
    key: "base",
    title: "Instrument Base",
    question: "What should anchor the sound?",
    options: ["🔊 Heavy Bass & Beats", "🎸 Acoustic / Unplugged", "🎹 Synth-Driven",
               "🎙️ Vocal-Focused", "🎼 Instrumental-Heavy", "⚡ Electric Riffs"],
    placeholder: "Custom base (e.g. Lo-fi piano, 808 sub-bass)…",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [prompt, setPrompt]               = useState("");
  const [songCount, setSongCount]         = useState(10);
  const [inputValue, setInputValue]       = useState("10");
  const [step, setStep]                   = useState<AppStep>("idle");
  const [currentStepIdx, setCurrentStepIdx] = useState(-1);
  const [songs, setSongs]                 = useState<SongRecommendation[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Set<number>>(new Set());
  const [error, setError]                 = useState<string | null>(null);
  const [health, setHealth]               = useState<HealthStatus | null>(null);
  const [statusMsg, setStatusMsg]         = useState("");
  const [downloadComplete, setDownloadComplete] = useState(false);

  // Quiz
  const [quizAnswers, setQuizAnswers] = useState({ type: "", vibe: "", trend: "", theme: "", base: "" });
  const [quizStep, setQuizStep]       = useState(0);
  const [customAnswer, setCustomAnswer] = useState("");

  const isLoading = step === "thinking" || step === "downloading";

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => { setInputValue(songCount.toString()); }, [songCount]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleSong = useCallback((idx: number) => {
    setSelectedSongs((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSongs(new Set(songs.map((_, i) => i)));
  }, [songs]);

  const handleCountChange = (val: string) => {
    setInputValue(val);
    const n = parseInt(val, 10);
    if (!isNaN(n)) setSongCount(Math.max(1, n));
  };

  const handleCountBlur = () => {
    const n = parseInt(inputValue, 10);
    const clamped = isNaN(n) ? 10 : Math.max(1, n);
    setSongCount(clamped);
    setInputValue(clamped.toString());
  };

  // ── Core actions ───────────────────────────────────────────────────────────

  const executeGeneration = async (answers = quizAnswers) => {
    if (!prompt.trim()) return;

    setError(null);
    setStep("thinking");
    setCurrentStepIdx(0);
    setSongs([]);
    setSelectedSongs(new Set());
    setDownloadComplete(false);
    setStatusMsg("Gemini is curating your playlist…");

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), count: songCount, quiz: answers }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recommendation failed");

      const fetched: SongRecommendation[] = data.songs;
      setSongs(fetched);
      setSelectedSongs(new Set(fetched.map((_: SongRecommendation, i: number) => i)));
      setCurrentStepIdx(1);
      setStep("songs");
      setStatusMsg(`Found ${fetched.length} songs. Select which to download.`);
    } catch (e) {
      setError((e as Error).message);
      setStep("idle");
      setCurrentStepIdx(-1);
    }
  };

  const handleStartQuiz = () => {
    setQuizStep(0);
    setQuizAnswers({ type: "", vibe: "", trend: "", theme: "", base: "" });
    setCustomAnswer("");
    setStep("quiz");
  };

  const handleQuizNext = (selected?: string) => {
    const cfg = QUIZ_STEPS[quizStep];
    const answer = selected ?? customAnswer.trim();
    const updated = { ...quizAnswers, [cfg.key]: answer };
    setQuizAnswers(updated);
    setCustomAnswer("");
    if (quizStep < QUIZ_STEPS.length - 1) setQuizStep((p) => p + 1);
    else executeGeneration(updated);
  };

  const handleQuizBack = () => {
    if (quizStep > 0) {
      setQuizStep((p) => p - 1);
      setCustomAnswer(quizAnswers[QUIZ_STEPS[quizStep - 1].key] || "");
    } else {
      setStep("idle");
    }
  };

  const handleQuizSkip = () => {
    const cfg = QUIZ_STEPS[quizStep];
    const updated = { ...quizAnswers, [cfg.key]: "" };
    setQuizAnswers(updated);
    setCustomAnswer("");
    if (quizStep < QUIZ_STEPS.length - 1) setQuizStep((p) => p + 1);
    else executeGeneration(updated);
  };

  const handleDownload = async () => {
    if (selectedSongs.size === 0) return;

    setError(null);
    setStep("downloading");
    setCurrentStepIdx(2);
    setDownloadComplete(false);

    const toDownload = songs.filter((_, i) => selectedSongs.has(i));

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: toDownload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Download failed");
      }

      setCurrentStepIdx(3);
      const blob = await res.blob();

      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `MusicNowEasy-${toDownload.length}-songs.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep("done");
      setCurrentStepIdx(4);
      setDownloadComplete(true);
      setStatusMsg(`✓ ${toDownload.length} song${toDownload.length !== 1 ? "s" : ""} downloaded.`);
    } catch (e) {
      setError((e as Error).message);
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
    setQuizStep(0);
    setQuizAnswers({ type: "", vibe: "", trend: "", theme: "", base: "" });
    setCustomAnswer("");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const showInputPanel  = step === "idle" || step === "quiz";
  const showSongs       = songs.length > 0 && step !== "thinking";
  const showProgressBar = step === "thinking" || step === "downloading";

  return (
    <div className="page">

      {/* ── Header ── */}
      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <Image src="/logo.png" alt="MusicNowEasy logo" width={26} height={26} className="brand-logo" priority />
            <span className="brand-name">MusicNowEasy</span>
          </div>
          <div className="header-chips">
            {health && (
              <>
                <span className={`h-chip ${health.gemini ? "ok" : "err"}`}>
                  <span className="h-dot" />Gemini
                </span>
                <span className={`h-chip ${health.ytdlp ? "ok" : "err"}`}>
                  <span className="h-dot" />yt-dlp
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">
        <div className="wrap">

          {/* Hero */}
          <div className="hero">
            <div className="hero-badge">✦ Powered by Gemini AI</div>
            <h1 className="hero-title">Discover music that moves you.</h1>
            <p className="hero-sub">
              Describe what you're feeling — Gemini curates the playlist, you download it instantly.
            </p>
          </div>

          {/* Prereqs warning */}
          {health && (!health.gemini || !health.ytdlp) && (
            <div className="prereqs">
              <p className="prereqs-title">⚠ Setup Required</p>
              <div className="prereqs-list">
                <span className={`prereq ${health.gemini ? "ok" : "fail"}`}>{health.gemini ? "✓" : "✗"} Gemini API</span>
                <span className={`prereq ${health.ytdlp  ? "ok" : "fail"}`}>{health.ytdlp  ? "✓" : "✗"} yt-dlp</span>
              </div>
            </div>
          )}

          {/* Error / success banners */}
          {error && (
            <div className="alert error">
              <span className="alert-icon">⚠</span>
              <span>{error}</span>
            </div>
          )}
          {downloadComplete && (
            <div className="alert success">
              <span className="alert-icon">✓</span>
              <span>{statusMsg}</span>
            </div>
          )}

          {/* ── INPUT / QUIZ PANEL ── */}
          {showInputPanel && (
            <div className="card">

              {/* ── IDLE: prompt form ── */}
              {step === "idle" && (
                <>
                  {/* Examples */}
                  <div className="label">✦ Quick starts</div>
                  <div className="chips-row">
                    {EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        className="example-chip"
                        disabled={isLoading}
                        onClick={() => setPrompt(ex.replace(/^.{2}\s*/, ""))}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>

                  <div className="divider" />

                  {/* Prompt textarea */}
                  <div className="label">✦ Describe your music</div>
                  <textarea
                    id="music-prompt"
                    className="prompt-area"
                    placeholder="e.g. Sad Hindi love songs for a late-night drive in the rain…"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isLoading}
                    maxLength={500}
                    rows={3}
                  />
                  <p className={`char-hint${prompt.length > 450 ? " warn" : ""}`}>
                    {prompt.length} / 500
                  </p>

                  <div className="divider" />

                  {/* Song count */}
                  <div className="label" style={{ marginBottom: 12 }}>🎵 Number of songs</div>
                  <div className="count-wrap">
                    <div className="presets">
                      {[5, 10, 15, 20, 30].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={`preset${songCount === n ? " on" : ""}`}
                          onClick={() => !isLoading && setSongCount(n)}
                          disabled={isLoading}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <div className="stepper">
                      <button
                        type="button"
                        className="step-btn"
                        onClick={() => !isLoading && setSongCount((p) => Math.max(1, p - 1))}
                        disabled={isLoading || songCount <= 1}
                      >−</button>
                      <input
                        type="text"
                        className="step-val"
                        value={inputValue}
                        onChange={(e) => handleCountChange(e.target.value)}
                        onBlur={handleCountBlur}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        className="step-btn"
                        onClick={() => !isLoading && setSongCount((p) => p + 1)}
                        disabled={isLoading}
                      >+</button>
                    </div>
                  </div>

                  <div className="divider" />

                  {/* CTAs */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    <button
                      id="quiz-btn"
                      type="button"
                      className="btn btn-primary"
                      onClick={handleStartQuiz}
                      disabled={isLoading || !prompt.trim()}
                    >
                      ✦ Refine with Quiz
                    </button>
                    <button
                      id="generate-btn"
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => executeGeneration({ type: "", vibe: "", trend: "", theme: "", base: "" })}
                      disabled={isLoading || !prompt.trim()}
                    >
                      Generate Immediately →
                    </button>
                  </div>
                </>
              )}

              {/* ── QUIZ ── */}
              {step === "quiz" && (
                <div className="quiz-wrap">
                  <div className="quiz-meta">
                    <span className="quiz-step-lbl">{QUIZ_STEPS[quizStep].title}</span>
                    <span className="quiz-step-num">{quizStep + 1} / {QUIZ_STEPS.length}</span>
                  </div>

                  <div className="quiz-bar">
                    <div
                      className="quiz-bar-fill"
                      style={{ width: `${((quizStep + 1) / QUIZ_STEPS.length) * 100}%` }}
                    />
                  </div>

                  <h2 className="quiz-q">{QUIZ_STEPS[quizStep].question}</h2>

                  <div className="quiz-grid">
                    {QUIZ_STEPS[quizStep].options.map((opt) => {
                      const label = opt.replace(/^\S+\s/, "").trim();
                      const isOn  = quizAnswers[QUIZ_STEPS[quizStep].key] === label;
                      return (
                        <button
                          key={opt}
                          type="button"
                          className={`quiz-opt${isOn ? " on" : ""}`}
                          onClick={() => handleQuizNext(label)}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>

                  <p className="quiz-custom-lbl">Or type a custom answer</p>
                  <input
                    type="text"
                    className="quiz-input"
                    placeholder={QUIZ_STEPS[quizStep].placeholder}
                    value={customAnswer}
                    onChange={(e) => setCustomAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuizNext()}
                  />

                  <div className="quiz-nav">
                    <button type="button" className="btn btn-ghost" onClick={handleQuizBack}>
                      ← Back
                    </button>
                    <div className="quiz-nav-right">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleQuizSkip}>
                        Skip
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => executeGeneration()}
                      >
                        Generate Now
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary quiz-gen-btn"
                        onClick={() => handleQuizNext()}
                      >
                        {quizStep === QUIZ_STEPS.length - 1 ? "Generate ✦" : "Next →"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROGRESS BAR ── */}
          {showProgressBar && (
            <div className="steps-wrap" style={{ position: "relative" }}>
              <div className="steps-line-bg" />
              <div
                className="steps-line-fill"
                style={{
                  width: `calc(${(Math.max(0, currentStepIdx) / (PROG_STEPS.length - 1)) * 100}% * (1 - 2 / ${PROG_STEPS.length * 2}))`,
                }}
              />
              {PROG_STEPS.map((s, i) => {
                const isDone   = i < currentStepIdx;
                const isActive = i === currentStepIdx;
                return (
                  <div key={s.label} className="step-item">
                    <div className={`step-dot${isActive ? " active" : isDone ? " done" : ""}`}>
                      {isDone ? "✓" : s.icon}
                    </div>
                    <span className={`step-lbl${isActive ? " active" : isDone ? " done" : ""}`}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── THINKING STATE ── */}
          {step === "thinking" && (
            <div className="loading-panel">
              <div className="spin spin-lg" />
              <p className="loading-title">Gemini is curating your playlist…</p>
              <p className="loading-sub">Finding the perfect songs based on your taste</p>
            </div>
          )}

          {/* ── SONGS LIST ── */}
          {showSongs && (
            <div className="songs-wrap">
              <div className="songs-head">
                <div className="songs-head-left">
                  <h2 className="songs-title">Your Playlist</h2>
                  <span className="songs-badge">{songs.length} songs</span>
                </div>
                <div className="songs-head-right">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={selectAll}>
                    Select All
                  </button>
                </div>
              </div>

              <div className="song-list">
                {songs.map((song, idx) => (
                  <div
                    key={`${song.title}-${idx}`}
                    className={`song-row${selectedSongs.has(idx) ? " on" : ""}`}
                    onClick={() => toggleSong(idx)}
                    role="checkbox"
                    aria-checked={selectedSongs.has(idx)}
                    tabIndex={0}
                    onKeyDown={(e) => (e.key === " " || e.key === "Enter") && toggleSong(idx)}
                    style={{ animationDelay: `${Math.min(idx * 0.025, 0.5)}s` }}
                  >
                    <span className="song-num">{idx + 1}</span>
                    <div className="song-icon">♪</div>
                    <div className="song-info">
                      <div className="song-title">{song.title}</div>
                      <div className="song-artist">{song.artist}</div>
                    </div>
                    <div className="song-check">✓</div>
                  </div>
                ))}
              </div>

              {/* Download footer */}
              <div className="dl-footer">
                <div className="dl-meta-row">
                  <span className="dl-count">
                    <strong>{selectedSongs.size}</strong> of {songs.length} selected
                  </span>
                  <span className="fmt-badge">🎵 M4A · High Quality</span>
                </div>
                <div className="dl-actions">
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleReset}
                    disabled={isLoading}
                  >
                    ↺ New Search
                  </button>
                  <button
                    id="download-btn"
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownload}
                    disabled={selectedSongs.size === 0 || isLoading}
                  >
                    {step === "downloading" ? (
                      <><div className="spin" /> Downloading {selectedSongs.size} songs…</>
                    ) : downloadComplete ? (
                      <>✓ Download Again</>
                    ) : (
                      <>◈ Download {selectedSongs.size} song{selectedSongs.size !== 1 ? "s" : ""} as ZIP</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Downloading hint below songs list */}
          {step === "downloading" && (
            <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--t3)", marginTop: 14, lineHeight: 1.6 }}>
              Songs are being downloaded and packaged concurrently.<br />
              This may take a few minutes depending on playlist size.
            </p>
          )}

        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="site-footer">
        <p>MusicNowEasy · Powered by Gemini AI & yt-dlp · For personal use only</p>
      </footer>

    </div>
  );
}
