// Loads the single source-of-truth resume JSON (shared with the matcher) at
// runtime so the dashboard never forks the candidate's facts.

import { promises as fs } from 'fs';
import path from 'path';
import type { BaseResume } from './resume-template';

// Dashboard runs with cwd = dashboard/. The canonical file lives one level up.
const CANDIDATES = [
  path.resolve(process.cwd(), '../agents/resume-generator/base-resume.json'),
  path.resolve(process.cwd(), 'agents/resume-generator/base-resume.json'),
];

let cache: BaseResume | null = null;

export async function loadBaseResume(): Promise<BaseResume> {
  if (cache) return cache;
  for (const p of CANDIDATES) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      cache = JSON.parse(raw) as BaseResume;
      return cache;
    } catch {
      /* try next */
    }
  }
  throw new Error('base-resume.json not found (looked in ../agents/resume-generator).');
}
