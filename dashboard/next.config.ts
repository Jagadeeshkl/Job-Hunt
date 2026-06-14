import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.google.com'],
  },
  // Keep the headless-Chromium packages out of the webpack bundle (loaded at
  // runtime in the Node function).
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // This is an npm-workspaces monorepo; pin the trace root to the repo root so
  // the hoisted node_modules is reachable.
  outputFileTracingRoot: path.join(process.cwd(), '..'),
  // Force the FULL @sparticuz/chromium package — the Chromium binary AND its
  // shared-library bundles (libnss3 etc.) — into the /api/approve function.
  // Next's tracer won't auto-include them (read from disk at runtime, not
  // require()'d). Globs cover both hoisted (repo root) and local node_modules.
  outputFileTracingIncludes: {
    '/api/approve': [
      '../node_modules/@sparticuz/chromium/**',
      './node_modules/@sparticuz/chromium/**',
      'node_modules/@sparticuz/chromium/**',
    ],
  },
};

export default nextConfig;
