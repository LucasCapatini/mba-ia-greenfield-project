import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained `.next/standalone` for the production image (home-search-production/TD-11).
  output: "standalone",
};

export default nextConfig;
