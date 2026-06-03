import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MusicNowEasy — AI-Powered Song Downloader",
  description:
    "Describe the music you want, and MusicNowEasy will find and download it for you as MP3 files using AI. Powered by Gemini AI and YouTube.",
  keywords: [
    "music downloader",
    "AI music",
    "mp3 download",
    "song finder",
    "Gemini AI",
    "playlist generator",
  ],
  openGraph: {
    title: "MusicNowEasy — AI-Powered Song Downloader",
    description: "Describe the music you want. Get an instant MP3 download.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
