import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Neon serverless driver runs on the edge/node runtimes fine; keep defaults.
  },
};

export default nextConfig;
