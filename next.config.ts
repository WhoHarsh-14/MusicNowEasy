import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow longer API response time for download route (up to 5 minutes)
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Allow image from local public directory
  images: {
    domains: [],
  },
};

export default nextConfig;
