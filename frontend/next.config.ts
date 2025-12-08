import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set turbopack root to this directory to avoid lockfile detection issues
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
