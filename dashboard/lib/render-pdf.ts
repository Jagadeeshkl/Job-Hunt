// Renders HTML strings to PDF Buffers using a headless browser via puppeteer-core.
// page.pdf() produces a true vector PDF (selectable text, ATS-friendly) and honours
// the template's @page A4 size via preferCSSPageSize.
//
// In production (Render container) CHROME_PATH points to the system Chromium;
// locally it falls back to an installed Edge/Chrome so `npm run dev` works.

import { promises as fs } from 'fs';
import puppeteer from 'puppeteer-core';

const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean) as string[];

let cachedBrowser: string | null = null;

async function resolveBrowser(): Promise<string> {
  if (cachedBrowser) return cachedBrowser;
  for (const p of BROWSER_CANDIDATES) {
    try {
      await fs.access(p);
      cachedBrowser = p;
      return p;
    } catch {
      /* keep looking */
    }
  }
  throw new Error('No Chromium/Edge found for PDF rendering. Set CHROME_PATH.');
}

// Render several HTML documents through ONE browser instance.
export async function renderPdfs(htmls: string[]): Promise<Buffer[]> {
  const executablePath = await resolveBrowser();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const out: Buffer[] = [];
    for (const html of htmls) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        printBackground: true,    // keep the blue/white colours
        preferCSSPageSize: true,  // honour the template's @page A4 size/margins
      });
      await page.close();
      out.push(Buffer.from(pdf));
    }
    return out;
  } finally {
    await browser.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  return (await renderPdfs([html]))[0];
}
