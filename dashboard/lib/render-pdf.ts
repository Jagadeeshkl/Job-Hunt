// Renders HTML strings to PDF Buffers using headless Chromium via puppeteer.
// page.pdf() produces a true vector PDF (selectable text, ATS-friendly) and honours
// the template's @page A4 size via preferCSSPageSize.
//
// Chromium version matters: we use the full `puppeteer` package so it drives its
// OWN bundled, version-matched Chromium (downloaded at build). We deliberately do
// NOT use the system apt chromium on Render — Debian floats it to bleeding-edge
// builds (e.g. 150.x) that this puppeteer can't launch. In local dev we fall back
// to an installed Edge/Chrome via CHROME_PATH so `npm run dev` needs no download.

import { promises as fs } from 'fs';
import puppeteer from 'puppeteer';

// Dev-only executables. In production CHROME_PATH is unset → puppeteer uses its
// bundled Chromium (no entry here resolves, so executablePath is omitted).
const DEV_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean) as string[];

let cachedBrowser: string | undefined;
let resolved = false;

// Returns a dev browser path, or undefined so puppeteer uses its bundled Chromium.
async function resolveBrowser(): Promise<string | undefined> {
  if (resolved) return cachedBrowser;
  for (const p of DEV_CANDIDATES) {
    try {
      await fs.access(p);
      cachedBrowser = p;
      break;
    } catch {
      /* keep looking */
    }
  }
  resolved = true;
  return cachedBrowser;
}

// Render several HTML documents through ONE browser instance.
export async function renderPdfs(htmls: string[]): Promise<Buffer[]> {
  const executablePath = await resolveBrowser();
  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : {}), // omit → bundled Chromium
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    const out: Buffer[] = [];
    for (const html of htmls) {
      const page = await browser.newPage();
      // 'load' (not 'networkidle0') — the template has no external resources, and
      // networkidle0 hangs on Chrome's background favicon request (→ 30s timeout).
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
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
