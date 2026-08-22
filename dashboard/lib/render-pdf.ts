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

// Chromium stamps the Info dictionary with its own identity — /Creator becomes the
// full "…HeadlessChrome/149.0.0.0…" UA string and /Producer becomes "Skia/PDF m149".
// A recruiter (or an ATS) reading file properties would see the document was machine
// generated, so we blank both before the PDF leaves this process. /Title is kept: it
// is our own text and reads well in a viewer tab.
//
// page.pdf() exposes no metadata options and pdf-lib is not a dashboard dependency,
// so this edits the bytes directly. The values are overwritten with SPACES rather
// than deleted, keeping every byte offset identical so the xref table stays valid —
// a length-changing edit would corrupt the file. Chromium emits PDF 1.4, which has
// no object streams, so the Info dictionary is always uncompressed and greppable.
const META_KEYS = ['Creator', 'Producer'] as const;

const LPAREN = 0x28;
const RPAREN = 0x29;
const BACKSLASH = 0x5c;
const SPACE = 0x20;

// A PDF literal string is delimited by balanced parens, and a backslash escapes the
// next byte. Chromium's UA lands here as "Mozilla/5.0 \(Windows NT 10.0…\)…", so a
// naive /\(([^)]*)\)/ stops at the first escaped paren and leaves "HeadlessChrome"
// in the file. This walks the string the way a PDF parser does instead.
// Returns the index just past the closing paren, or -1 if the string is malformed.
function blankLiteralString(buf: Buffer, open: number): number {
  let depth = 1;
  let i = open + 1;
  while (i < buf.length) {
    const c = buf[i];
    if (c === BACKSLASH) {
      buf.fill(SPACE, i, Math.min(i + 2, buf.length)); // blank escape AND its target
      i += 2;
      continue;
    }
    if (c === LPAREN) depth++;
    else if (c === RPAREN && --depth === 0) return i + 1;
    buf[i] = SPACE;
    i++;
  }
  return -1;
}

export function stripPdfMetadata(pdf: Buffer): Buffer {
  const out = Buffer.from(pdf);
  const text = out.toString('latin1'); // byte-per-char, so indices map 1:1
  for (const key of META_KEYS) {
    // Only literal strings are handled; a hex string (/Title <FEFF…>) is left alone.
    const re = new RegExp(`/${key}[\\s]*\\(`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      blankLiteralString(out, m.index + m[0].length - 1);
    }
  }
  return out; // never resized: every byte offset (and the xref table) stays valid
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
      out.push(stripPdfMetadata(Buffer.from(pdf)));
    }
    return out;
  } finally {
    await browser.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  return (await renderPdfs([html]))[0];
}
