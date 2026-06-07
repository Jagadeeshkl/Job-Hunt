// Renders an HTML string to a PDF Buffer using a headless Chromium/Edge browser.
// Used by the Approve flow to produce the locked resume/cover-letter look. Runs
// server-side only (spawns a local browser), so the dashboard must run on a
// machine that has Edge or Chrome installed.

import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean) as string[];

let cachedBrowser: string | null = null;

async function findBrowser(): Promise<string> {
  if (cachedBrowser) return cachedBrowser;
  for (const p of CANDIDATES) {
    try {
      await fs.access(p);
      cachedBrowser = p;
      return p;
    } catch {
      /* keep looking */
    }
  }
  throw new Error('No Edge/Chrome found for PDF rendering. Set CHROME_PATH in .env.local.');
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await findBrowser();
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
