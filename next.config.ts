import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Fix: Turbopack generates hashed module IDs for Prisma (@prisma/client-xxxx)
  // that can't be resolved in the standalone build. Mark as external to use
  // regular require('@prisma/client') instead.
  serverExternalPackages: ['@prisma/client', '.prisma/client'],
  // Bake env vars into the standalone build at compile time.
  // This is the most reliable way to bundle secrets in a packaged Electron desktop app.
  env: {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    COBALT_URL: process.env.COBALT_URL,
  },
  images: {
    domains: ['i.scdn.co', 'mosaic.scdn.co'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
      ]
    }]
  }
};

export default nextConfig;
