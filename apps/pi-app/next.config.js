const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  allowedDevOrigins: ["*.ngrok-free.dev", "localhost:3002", "192.168.1.193:3002"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
};

module.exports = nextConfig;