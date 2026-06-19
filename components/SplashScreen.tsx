"use client";

import { useState, useEffect } from "react";

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Start fading out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2500);

    // Completely remove from DOM after 3 seconds (allowing 500ms for fade out animation)
    const removeTimer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[#0a0a0a] flex flex-col items-center justify-center transition-opacity duration-500 ease-in-out ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-dark/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated DJ Vinyl / Logo Graphic */}
        <div className="relative w-32 h-32 mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary border-r-gold-light animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full border-2 border-primary/20 border-b-gold-light animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-[48px] text-primary drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]">
              headphones
            </span>
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary via-gold-light to-primary animate-pulse tracking-tight drop-shadow-md">
            Welcome
          </h1>
          <h2 className="font-display text-3xl md:text-4xl text-text-primary tracking-widest uppercase flex items-center gap-4">
            <span className="w-8 h-[1px] bg-primary/50" />
            Jainny the Boss
            <span className="w-8 h-[1px] bg-primary/50" />
          </h2>
        </div>

        {/* Equalizer Loading Bars */}
        <div className="flex items-center justify-center gap-1.5 mt-12">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="w-1.5 bg-primary rounded-t-sm"
              style={{
                height: '24px',
                animation: `equalizer 1s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.15}s`,
                transformOrigin: 'bottom',
              }}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes equalizer {
          0% { transform: scaleY(0.3); opacity: 0.5; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
