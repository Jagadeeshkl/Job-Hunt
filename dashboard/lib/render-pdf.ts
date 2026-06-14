// Renders an HTML string to a PDF Buffer.
//
// Two backends, picked automatically:
//   • Serverless (Vercel / Linux): puppeteer-core + @sparticuz/chromium — a
//     Chromium build that runs inside a serverless function. Used in production.
//   • Local dev (Windows/Mac with Edge or Chrome installed): drives the installed
//     browser via `--print-to-pdf`. Keeps `npm run dev` working with zero extra
//     downloads. Set CHROME_PATH in .env.local to override the browser location.

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Locally-installed browsers to try (dev only).
const LOCAL_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean) as string[];

let cachedBrowser: string | null = null;

async function findLocalBrowser(): Promise<string | null> {
  if (cachedBrowser) return cachedBrowser;
  for (const p of LOCAL_CANDIDATES) {
    try {
      await fs.access(p);
      cachedBrowser = p;
      return p;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

// Complete Chromium pack (binary + shared libraries) matching @sparticuz/chromium-min
// 131.0.0. Downloaded to /tmp at runtime so the libs (libnss3, etc.) are always
// present — avoids Next file-tracing dropping them from the function bundle.
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar';

// --- Serverless backend (Vercel / AWS Lambda) ----------------------------------
async function renderWithServerlessChromium(html: string): Promise<Buffer> {
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const puppeteer = (await import('puppeteer-core')).default;

  const launchOptions = {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: chromium.headless,
  };

  // The Chromium binary is unpacked to /tmp and can briefly be "busy" (its write
  // handle not yet released) when we spawn it → `spawn ETXTBSY`. Retry a few
  // times with a short backoff; the file settles within a few hundred ms.
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      browser = await puppeteer.launch(launchOptions);
      break;
    } catch (e) {
      lastErr = e;
      if (String((e as Error)?.message ?? e).includes('ETXTBSY')) {
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  if (!browser) throw lastErr;

  try {
    const page = await browser.newPage();
    // Load the HTML and wait for fonts/styles before printing.
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      printBackground: true,      // keep the blue/white colours
      preferCSSPageSize: true,    // honour the template's @page size/margins
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// --- Local backend (installed Edge/Chrome via --print-to-pdf) -------------------
async function renderWithLocalBrowser(browser: string, html: string): Promise<Buffer> {
  const id = randomUUID();
  const tmp = os.tmpdir();
  const htmlPath = path.join(tmp, `doc-${id}.html`);
  const pdfPath = path.join(tmp, `doc-${id}.pdf`);
  const userDataDir = path.join(tmp, `edgepdf-${id}`);

  await fs.writeFile(htmlPath, html, 'utf8');

  try {
    await execFileAsync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--virtual-time-budget=8000',
        '--run-all-compositor-stages-before-draw',
        `--user-data-dir=${userDataDir}`,
        `--print-to-pdf=${pdfPath}`,
        `file:///${htmlPath.replace(/\\/g, '/')}`,
      ],
      { timeout: 30000 }
    );

    return await fs.readFile(pdfPath);
  } finally {
    // Best-effort cleanup of the temp artefacts.
    fs.rm(htmlPath, { force: true }).catch(() => {});
    fs.rm(pdfPath, { force: true }).catch(() => {});
    fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  // On Vercel always use the bundled serverless Chromium. Locally, prefer an
  // installed Edge/Chrome (no downloads needed); fall back to serverless Chromium
  // if none is found.
  if (!process.env.VERCEL) {
    const local = await findLocalBrowser();
    if (local) return renderWithLocalBrowser(local, html);
  }
  return renderWithServerlessChromium(html);
}
