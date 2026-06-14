import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.google.com'],
  },
  // Keep the headless-Chromium packages out of the webpack bundle so their
  // native/binary files are traced into the serverless function intact.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // Force-include the full @sparticuz/chromium package (the brotli'd Chromium
  // binary AND its shared-library bundles, e.g. libnss3) into the /api/approve
  // function. Next's tracer doesn't auto-include them because they're read from
  // disk at runtime, not require()'d — without this you get
  // "libnss3.so: cannot open shared object file". Globs cover both the hoisted
  // (workspace root) and local node_modules locations.
  outputFileTracingIncludes: {
    '/api/approve': [
      './node_modules/@sparticuz/chromium/**',
      '../node_modules/@sparticuz/chromium/**',
    ],
  },
};

export default nextConfig;
