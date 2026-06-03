import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { discoverNewJobs } from './apify-search';
import { fetchGreenhouseJobs, type JobListing } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchAshbyJobs } from './ashby';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const MAX_NEW_JOBS_PER_RUN = 50;
const TARGET_LOCATIONS = ['chennai', 'bangalore', 'bengaluru', 'karnataka', 'tamil nadu', 'remote', 'india'];

type Ats = 'greenhouse' | 'lever' | 'ashby';

function isTargetLocation(location: string): boolean {
  const lower = (location ?? '').toLowerCase();
  return TARGET_LOCATIONS.some(loc => lower.includes(loc));
}

async function getExistingUrls(): Promise<Set<string>> {
  const { data, error } = await supabase.from('applications').select('jd_url');
  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return new Set((data ?? []).map((r: any) => r.jd_url as string));
}

async function fetchBoard(ats: Ats, atsId: string, company: string): Promise<JobListing[]> {
  if (ats === 'greenhouse') {
    return (await fetchGreenhouseJobs(company, atsId)).map(j => ({ ...j, ats_type: 'greenhouse' as const }));
  }
  if (ats === 'lever') {
    return (await fetchLeverJobs(company, atsId)).map(j => ({ ...j, ats_type: 'greenhouse' as const }));
  }
  return (await fetchAshbyJobs(company, atsId)).map(j => ({ ...j, ats_type: 'greenhouse' as const }));
}

// Map our internal Ats to the DB ats_type enum.
function dbAtsType(ats: Ats): string {
  return ats; // enum includes greenhouse | lever | ashby
}

async function insertJobs(jobs: (JobListing & { _ats: Ats })[]): Promise<number> {
  if (jobs.length === 0) return 0;
  const rows = jobs.map(j => ({
    company: j.company,
    role: j.role,
    jd_url: j.jd_url,
    jd_text: j.jd_text,
    location: j.location,
    salary_range: j.salary_range,
    ats_type: dbAtsType(j._ats),
    status: 'scraped',
  }));
  const { error } = await supabase.from('applications').insert(rows);
  if (error) {
    console.error('[discover] insert error:', error.message);
    return 0;
  }
  return rows.length;
}

// Turn an ats_id slug into a readable company name: "jazzx-ai" -> "Jazzx Ai".
function prettyName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function main() {
  console.log('[discover] Discovering new ATS boards via Apify…');
  const discovered = await discoverNewJobs();

  // Collapse to unique boards (the discovery returns individual job URLs).
  const boards = new Map<string, { ats: Ats; atsId: string }>();
  for (const d of discovered) {
    const key = `${d.ats}:${d.ats_id}`;
    if (!boards.has(key)) boards.set(key, { ats: d.ats, atsId: d.ats_id });
  }
  console.log(`[discover] ${boards.size} unique boards discovered.`);

  const existingUrls = await getExistingUrls();
  const toInsert: (JobListing & { _ats: Ats })[] = [];
  let duplicates = 0;
  let skippedLocation = 0;

  for (const { ats, atsId } of boards.values()) {
    if (toInsert.length >= MAX_NEW_JOBS_PER_RUN) break;

    const company = prettyName(atsId);
    let jobs: JobListing[] = [];
    try {
      jobs = await fetchBoard(ats, atsId, company);
    } catch (err) {
      console.warn(`[discover] ${company} (${ats}/${atsId}) fetch failed:`, err);
      continue;
    }

    for (const job of jobs) {
      if (toInsert.length >= MAX_NEW_JOBS_PER_RUN) break;
      if (existingUrls.has(job.jd_url)) { duplicates++; continue; }
      if (!isTargetLocation(job.location)) { skippedLocation++; continue; }
      existingUrls.add(job.jd_url);
      toInsert.push({ ...job, _ats: ats });
    }
    console.log(`[discover] ${company} (${ats}/${atsId}): ${jobs.length} AI roles on board`);
  }

  const inserted = await insertJobs(toInsert);
  console.log(
    `[discover] Done. ${inserted} new jobs inserted, ${duplicates} duplicates, ${skippedLocation} skipped (location).`
  );
}

main().catch(err => {
  console.error('[discover] Fatal:', err);
  process.exit(1);
});
