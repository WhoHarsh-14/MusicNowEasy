"use client";

import { useEffect, useState } from 'react';
import { prewarm } from '@/lib/prewarm';
import { usePlaylist } from '@/lib/store';
import { downloadPlaylist, DownloadProgress } from '@/lib/download';
import { AudioPlayer } from '@/components/AudioPlayer';
import { QueueDrawer } from '@/components/QueueDrawer';
import TitleBar from '@/components/TitleBar';
import { SplashScreen } from '@/components/SplashScreen';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    prewarm();
    if (typeof window !== 'undefined' && (window as any).electron) {
      setIsElectron(true);
    }
  }, []);

  return (
    <html lang="en" className="dark">
      <head>
        <title>BEATVAULT | DJ Song Library</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-bg-base text-text-primary overflow-x-hidden flex flex-col relative">
        <SplashScreen />
        <TitleBar />
        
        {/* Ambient Gold Glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold-dark/10 rounded-full blur-[120px] pointer-events-none z-[-1]" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[30%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-[-1]" />
        
        {/* Top Navigation Anchor */}
        <header className={`fixed ${isElectron ? 'top-8' : 'top-0'} w-full z-50 backdrop-blur-glass border-b border-border-strong flex justify-between items-center px-margin-desktop h-16 transition-all`}>
          <div className="font-display text-h2 font-bold text-primary tracking-tighter">BEATVAULT</div>
          <nav className="hidden md:flex gap-8 items-center h-full">
            <Link 
              className={`font-body text-body font-semibold transition-colors ${pathname === '/' ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-text-primary'}`} 
              href="/"
            >
              Catalogue
            </Link>
            <Link 
              className={`font-body text-body font-semibold transition-colors ${pathname === '/build' ? 'text-primary border-b-2 border-primary pb-1' : 'text-text-secondary hover:text-text-primary'}`} 
              href="/build"
            >
              Build Playlist
            </Link>
          </nav>

        </header>

        <div className={isElectron ? 'pt-8' : ''}>
          {children}
        </div>

        {/* Bottom Audio Player */}
        <AudioPlayer />
        <QueueDrawer />

        {/* Mobile Bottom Nav Shell */}
        <nav className="md:hidden fixed bottom-[72px] left-0 w-full h-16 bg-surface-container-highest/95 backdrop-blur-nav flex justify-around items-center px-4 pb-safe border-t border-border-strong z-50">
          <a className="flex flex-col items-center justify-center text-text-secondary" href="#">
            <span className="material-symbols-outlined">home</span>
            <span className="font-label text-label uppercase tracking-widest mt-1">Home</span>
          </a>
          <a className="flex flex-col items-center justify-center text-text-secondary" href="#">
            <span className="material-symbols-outlined">library_music</span>
            <span className="font-label text-label uppercase tracking-widest mt-1">Crates</span>
          </a>
          <a className="flex flex-col items-center justify-center text-primary" href="#">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
            <span className="font-label text-label uppercase tracking-widest mt-1">Build</span>
          </a>
          <a className="flex flex-col items-center justify-center text-text-secondary" href="#">
            <span className="material-symbols-outlined">settings</span>
            <span className="font-label text-label uppercase tracking-widest mt-1">Settings</span>
          </a>
        </nav>
      </body>
    </html>
  );
}
