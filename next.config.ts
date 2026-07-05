import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to accept requests from 127.0.0.1 (used by Playwright
  // and local testing) in addition to localhost.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
