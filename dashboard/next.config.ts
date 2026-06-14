import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.google.com'],
  },
  // Keep the headless-Chromium packages out of the webpack bundle so their
  // native/binary files are traced into the serverless function intact.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;
