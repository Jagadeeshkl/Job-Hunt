import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['www.google.com'],
  },
  // puppeteer-core is loaded at runtime in the Node server; keep it out of the bundle.
  serverExternalPackages: ['puppeteer-core'],
};

export default nextConfig;
