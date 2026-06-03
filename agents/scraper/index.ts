import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { fetchGreenhouseJobs, type JobListing } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchAshbyJobs } from './ashby';
import companyList from './company-list.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const MAX_NEW_JOBS_PER_RUN = 50;

// Only keep jobs in target cities or remote-friendly roles
const TARGET_LOCATIONS = ['chennai', 'bangalore', 'bengaluru', 'karnataka', 'tamil nadu', 'remote', 'india'];

function isTargetLocation(location: string): boolean {
  const lower = location.toLowerCase();
  return TARGET_LOCATIONS.some(loc => lower.includes(loc));
}

async function getExistingUrls(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('applications')
    .select('jd_url');

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return new Set((data ?? []).map((r: any) => r.jd_url as string));
}

async function insertJobs(jobs: JobListing[]): Promise<number> {
  if (jobs.length === 0) return 0;

  const rows = jobs.map(j => ({
    company: j.company,
    role: j.role,
    jd_url: j.jd_url,
    jd_text: j.jd_text,
    location: j.location,
    salary_range: j.salary_range,
    ats_type: j.ats_type,
    status: 'scraped',
  }));

  const { error } = await supabase.from('applications').insert(rows);
  if (error) {
    console.error('[scraper] insert error:', error.message);
    return 0;
  }
  return rows.length;
}

async function main() {
  console.log('[scraper] Starting daily scrape…');

  const existingUrls = await getExistingUrls();
  console.log(`[scraper] ${existingUrls.size} existing URLs in DB`);

  const allNew: JobListing[] = [];
  let duplicates = 0;

  for (const company of companyList as any[]) {
    if (allNew.length >= MAX_NEW_JOBS_PER_RUN) break;

    let jobs: JobListing[] = [];

    if (company.ats === 'greenhouse') {
      jobs = await fetchGreenhouseJobs(company.name, company.ats_id);
      jobs = jobs.map(j => ({ ...j, ats_type: 'greenhouse' as const }));
    } else if (company.ats === 'lever') {
      jobs = await fetchLeverJobs(company.name, company.ats_id);
      jobs = jobs.map(j => ({ ...j, ats_type: 'greenhouse' as const })); // ats_type enum default; DB stores lever separately
    } else if (company.ats === 'ashby') {
      jobs = await fetchAshbyJobs(company.name, company.ats_id);
      jobs = jobs.map(j => ({ ...j, ats_type: 'greenhouse' as const }));
    }

    for (const job of jobs) {
      if (existingUrls.has(job.jd_url)) {
        duplicates++;
        continue;
      }
      // Skip jobs not in Chennai, Bangalore, or Remote
      if (!isTargetLocation(job.location)) {
        continue;
      }
      existingUrls.add(job.jd_url); // prevent same-run dupes
      allNew.push(job);
      if (allNew.length >= MAX_NEW_JOBS_PER_RUN) break;
    }
  }

  const inserted = await insertJobs(allNew);
  console.log(`[scraper] Done. ${inserted} new jobs inserted, ${duplicates} duplicates skipped.`);
}

main().catch(err => {
  console.error('[scraper] Fatal:', err);
  process.exit(1);
});
