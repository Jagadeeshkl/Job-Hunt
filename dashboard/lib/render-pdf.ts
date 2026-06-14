// Renders HTML strings to PDF Buffers.
//
// Two backends, picked automatically:
//   • Serverless (Vercel / Linux): puppeteer-core + @sparticuz/chromium-min,
//     which downloads a complete Chromium pack (binary + shared libs) to /tmp at
//     runtime. Used in production.
//   • Local dev (Windows/Mac with Edge or Chrome installed): drives the installed
//     browser via `--print-to-pdf`. Keeps `npm run dev` working with zero extra
//     downloads. Set CHROME_PATH in .env.local to override the browser location.
//
// IMPORTANT: render multiple documents through ONE browser (renderPdfs), never by
// launching Chromium concurrently — two simultaneous launches race on the same
// /tmp binary and throw `spawn ETXTBSY` / can crash the function.

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

// --- Serverless backend (Vercel / AWS Lambda) ----------------------------------
// One browser, rendered sequentially → no concurrent /tmp binary race.
async function renderWithServerlessChromium(htmls: string[]): Promise<Buffer[]> {
  const chromium = (await import('@sparticuz/chromium')).default;
  const puppeteer = (await import('puppeteer-core')).default;

  const launchOptions = {
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
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
    const out: Buffer[] = [];
    for (const html of htmls) {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        printBackground: true,      // keep the blue/white colours
        preferCSSPageSize: true,    // honour the template's @page size/margins
      });
      await page.close();
      out.push(Buffer.from(pdf));
    }
    return out;
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

// Render several HTML documents to PDFs. Use this (not parallel htmlToPdf calls)
// when producing more than one document so Chromium is launched only once.
export async function renderPdfs(htmls: string[]): Promise<Buffer[]> {
  if (!process.env.VERCEL) {
    const local = await findLocalBrowser();
    if (local) {
      const out: Buffer[] = [];
      for (const html of htmls) out.push(await renderWithLocalBrowser(local, html)); // sequential
      return out;
    }
  }
  return renderWithServerlessChromium(htmls);
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  return (await renderPdfs([html]))[0];
}
