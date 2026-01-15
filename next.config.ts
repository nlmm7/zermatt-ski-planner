import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable build caching to force fresh builds
  experimental: {
    webpackBuildWorker: false,
  },
  // Generate unique build IDs to prevent caching issues
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
};

export default nextConfig;
