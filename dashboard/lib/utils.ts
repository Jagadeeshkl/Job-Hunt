import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional class names, de-duplicating conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * The matcher stores match_justification inconsistently: sometimes a JSON array
 * string (e.g. '["point a","point b"]'), sometimes newline/bullet text, sometimes
 * a plain sentence. Normalise any of these into a clean list of bullet points.
 */
export function parseJustification(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const text = raw.trim();
  if (!text) return [];

  // Try JSON array first.
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      if (Array.isArray(arr)) {
        return arr.map(s => String(s).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }

  // Split on newlines or leading bullet markers.
  const lines = text
    .split(/\r?\n|(?:^|\s)[•\-*]\s+/)
    .map(s => s.replace(/^["'\s]+|["'\s]+$/g, '').trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [text];
}
