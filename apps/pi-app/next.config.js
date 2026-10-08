const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === "production" ? "export" : undefined,
  // Default .next on purpose: Next 15.5 compiles into a custom distDir but
  // reads the export manifests from .next, so apps/tg-app/build.js shares this
  // one and wipes it around its build instead.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  allowedDevOrigins: ["*.ngrok-free.dev", "localhost:3002", "192.168.1.193:3002"],
  webpack: (config, { dev, webpack }) => {
    // The Pi build must not ship Adsgram's loader. A dynamic import still
    // emits its chunk, so replace the module outright unless this is the
    // Telegram build.
    if (process.env.NEXT_PUBLIC_APP_MODE !== "telegram") {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /[\/]pi[\/]adsgram$/,
          require.resolve("./src/pi/adsgram.noop.ts"),
        ),
      );
    }
    if (dev) {
      // Use in-memory cache in dev mode to eliminate Windows file-locking rename ENOENT errors
      config.cache = { type: "memory" };
    }
    return config;
  },
};

module.exports = nextConfig;