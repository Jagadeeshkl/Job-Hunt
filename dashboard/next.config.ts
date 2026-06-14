import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.google.com'],
  },
  // Keep these out of the webpack bundle (they're loaded at runtime in the
  // Node function). @sparticuz/chromium-min downloads the Chromium pack
  // (binary + libs) to /tmp at runtime, so no binary tracing is needed.
  serverExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core'],
};

export default nextConfig;
