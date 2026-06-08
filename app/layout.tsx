import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicNowEasy — AI Music Curator & Downloader",
  description:
    "Describe the music you're feeling — MusicNowEasy uses Gemini AI to curate a personalized playlist and downloads it as high-quality audio instantly.",
  keywords: ["music downloader", "AI playlist", "m4a download", "song curator", "Gemini AI"],
  openGraph: {
    title: "MusicNowEasy — AI Music Curator",
    description: "Describe your vibe. Get a curated playlist downloaded instantly.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
