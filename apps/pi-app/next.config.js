const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  // apps/tg-app builds this same source with its own dist dir (see tg-app/build.js)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  allowedDevOrigins: ["*.ngrok-free.dev", "localhost:3002", "192.168.1.193:3002"],
  webpack: (config, { dev }) => {
    if (dev) {
      // Use in-memory cache in dev mode to eliminate Windows file-locking rename ENOENT errors
      config.cache = { type: "memory" };
    }
    return config;
  },
};

module.exports = nextConfig;