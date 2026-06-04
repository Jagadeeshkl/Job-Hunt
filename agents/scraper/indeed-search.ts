import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';
import { supabaseClient, getExistingUrls, backlogCount, isTargetLocation } from './store';
import { MIN_JD_TEXT_CHARS } from './greenhouse';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
// misceres/indeed-scraper — returns structured jobs WITH full description text.
const ACTOR_ID = 'misceres~indeed-scraper';

// Focused AI/ML position keywords. Each is run as its own Indeed search so the
// platform's own relevance ranking applies per keyword (mixing them into one
// query dilutes relevance and triggers Indeed's noisy "broad match").
const POSITIONS = [
  'AI Engineer',
  'Machine Learning Engineer',
  'Generative AI',
  'LLM Engineer',
  'MLOps Engineer',
  'Data Scientist',
];

// India hubs to target. Indeed treats a blank/region location loosely, so we
// pin to specific hubs (plus Remote) for precise, on-target results.
const LOCATIONS = ['Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Remote'];

// Per-search cap. Indeed charges per returned listing ($0.006 each on the free
// tier), so keep this small — the matcher (Gemini) is the real bottleneck and
// can only score a few dozen jobs/day anyway.
const MAX_PER_SEARCH = 15;

// Don't pile up unscored jobs the matcher can't reach. Indeed only tops up to
// this backlog ceiling — same target the daily free scrape uses.
const BACKLOG_TARGET = 60;

// Hard cap on Indeed listings collected per run, regardless of backlog room,
// to keep Apify spend predictable.
const MAX_PER_RUN = 15;

interface IndeedRawJob {
  positionName?: string;
  company?: string;
  location?: string;
  salary?: string | null;
  description?: string;
  url?: string;
  externalApplyLink?: string | null;
  isExpired?: boolean;
}

export interface IndeedJob {
  company: string;
  role: string;
  jd_url: string;
  jd_text: string;
  location: string;
  salary_range: string | null;
  apply_url: string | null;
}

async function runIndeedSearch(position: string, location: string): Promise<IndeedRawJob[]> {
  // run-sync-get-dataset-items blocks until the run finishes and returns the
  // dataset directly — same pattern as the Google discovery actor.
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        position,
        location,
        country: 'IN',
        maxItemsPerSearch: MAX_PER_SEARCH,
        saveOnlyUniqueItems: true,
        parseCompanyDetails: false,
        followApplyRedirects: false,
      }),
    }
  );

  if (!res.ok) {
    console.warn(`[indeed] search failed (${position} @ ${location}): HTTP ${res.status}`);
    return [];
  }
  return (await res.json()) as IndeedRawJob[];
}

function toJob(raw: IndeedRawJob): IndeedJob | null {
  const jd_text = (raw.description ?? '').trim();
  const jd_url = raw.url ?? '';
  if (!jd_url || !raw.positionName) return null;
  if (raw.isExpired) return null;
  if (jd_text.length < MIN_JD_TEXT_CHARS) return null; // skip thin/un-tailorable JDs

  return {
    company: raw.company ?? 'Unknown',
    role: raw.positionName,
    jd_url,
    jd_text,
    location: raw.location ?? 'Unknown',
    salary_range: raw.salary ?? null,
    apply_url: raw.externalApplyLink ?? null,
  };
}

/**
 * Scrape AI/ML jobs from Indeed (India) until `budget` new, on-target,
 * non-duplicate jobs are collected. De-dupes by jd_url across the whole run and
 * against `existingUrls` (rows already in the DB).
 */
export async function fetchIndeedJobs(
  budget: number,
  existingUrls: Set<string>
): Promise<IndeedJob[]> {
  if (budget <= 0) return [];

  const collected: IndeedJob[] = [];
  const seen = new Set<string>();

  outer: for (const location of LOCATIONS) {
    for (const position of POSITIONS) {
      if (collected.length >= budget) break outer;
      console.log(`[indeed] searching: "${position}" @ ${location}`);
      let raw: IndeedRawJob[] = [];
      try {
        raw = await runIndeedSearch(position, location);
      } catch (err) {
        console.warn(`[indeed] error (${position} @ ${location}):`, err);
        continue;
      }

      for (const r of raw) {
        if (collected.length >= budget) break;
        const job = toJob(r);
        if (!job) continue;
        if (seen.has(job.jd_url) || existingUrls.has(job.jd_url)) continue;
        if (!isTargetLocation(job.location)) continue;
        seen.add(job.jd_url);
        existingUrls.add(job.jd_url);
        collected.push(job);
      }
    }
  }

  console.log(`[indeed] collected ${collected.length} new on-target jobs`);
  return collected;
}

/**
 * Insert Indeed jobs into the applications table. Indeed jobs cannot be
 * auto-applied through an ATS API, so they are flagged manual (ats_type =
 * 'custom', is_manual_required = true). Ignore-duplicate upsert on jd_url.
 */
export async function insertIndeedJobs(
  supabase: ReturnType<typeof supabaseClient>,
  jobs: IndeedJob[]
): Promise<number> {
  if (jobs.length === 0) return 0;
  const rows = jobs.map(j => ({
    company: j.company,
    role: j.role,
    jd_url: j.jd_url,
    jd_text: j.jd_text,
    location: j.location,
    salary_range: j.salary_range,
    ats_type: 'custom',
    is_manual_required: true,
    status: 'scraped',
  }));
  const { data, error } = await supabase
    .from('applications')
    .upsert(rows, { onConflict: 'jd_url', ignoreDuplicates: true })
    .select('id');
  if (error) {
    console.error('[indeed] insert error:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

// Standalone runner: `ts-node agents/scraper/indeed-search.ts [maxOverride]`
// Also invoked by the agent server (POST /run/indeed) and Workflow 05.
// Backlog-aware: only tops up to BACKLOG_TARGET so we never pay to scrape jobs
// the matcher can't reach. An optional CLI arg lowers the per-run cap further.
async function main() {
  const supabase = supabaseClient();

  const backlog = await backlogCount(supabase);
  const room = BACKLOG_TARGET - backlog;
  const cap = Number(process.argv[2]) || MAX_PER_RUN;
  const budget = Math.min(room, cap);

  console.log(`[indeed] Backlog ${backlog}/${BACKLOG_TARGET}; per-run cap ${cap} → budget ${budget}.`);
  if (budget <= 0) {
    console.log('[indeed] Backlog already at target — skipping Indeed scrape to save credit.');
    return;
  }

  console.log(`[indeed] Scraping up to ${budget} new AI/ML jobs from Indeed India…`);
  const existingUrls = await getExistingUrls(supabase);
  const jobs = await fetchIndeedJobs(budget, existingUrls);
  const inserted = await insertIndeedJobs(supabase, jobs);
  console.log(`[indeed] Done. ${inserted} new jobs inserted (manual-apply queue).`);
}

if (require.main === module) {
  main().catch(err => {
    console.error('[indeed] Fatal:', err);
    process.exit(1);
  });
}
