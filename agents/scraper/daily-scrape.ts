import * as dotenv from 'dotenv';
import path from 'path';
import { discoverNewJobs } from './apify-search';
import {
  supabaseClient, getExistingUrls, backlogCount, isTargetLocation,
  fetchBoard, insertJobs, prettyName, type Ats, type PendingJob,
} from './store';
import companyList from './company-list.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Keep the unscored backlog around one day's scoring capacity. Scraping is free,
// but matching is the bottleneck — there's no point piling up jobs we can't
// score for days. We only top up to this target each run.
const BACKLOG_TARGET = 60;

const supabase = supabaseClient();

interface Board { ats: Ats; atsId: string; company: string }

// Static curated companies, in list order.
function staticBoards(): Board[] {
  return (companyList as any[]).map(c => ({ ats: c.ats, atsId: c.ats_id, company: c.name }));
}

// Fresh boards discovered via Apify Google search.
async function discoveredBoards(): Promise<Board[]> {
  const discovered = await discoverNewJobs();
  const seen = new Set<string>();
  const boards: Board[] = [];
  for (const d of discovered) {
    const key = `${d.ats}:${d.ats_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    boards.push({ ats: d.ats, atsId: d.ats_id, company: prettyName(d.ats_id) });
  }
  return boards;
}

// Pull target-location, non-duplicate jobs from a set of boards until `budget`
// new jobs are collected. Returns the collected jobs.
async function harvest(
  boards: Board[],
  budget: number,
  existingUrls: Set<string>,
  label: string
): Promise<PendingJob[]> {
  const collected: PendingJob[] = [];
  for (const b of boards) {
    if (collected.length >= budget) break;
    let jobs;
    try {
      jobs = await fetchBoard(b.ats, b.atsId, b.company);
    } catch (err) {
      console.warn(`[daily-scrape] ${label} ${b.company} fetch failed:`, err);
      continue;
    }
    for (const job of jobs) {
      if (collected.length >= budget) break;
      if (existingUrls.has(job.jd_url)) continue;
      if (!isTargetLocation(job.location)) continue;
      existingUrls.add(job.jd_url);
      collected.push({ ...job, _ats: b.ats });
    }
  }
  return collected;
}

async function main() {
  const backlog = await backlogCount(supabase);
  console.log(`[daily-scrape] Current unscored backlog: ${backlog} (target ${BACKLOG_TARGET}).`);

  const room = BACKLOG_TARGET - backlog;
  if (room <= 0) {
    console.log('[daily-scrape] Backlog already at/above target — skipping scrape to let the matcher catch up.');
    return;
  }

  // Split the day's intake evenly between the curated list and Apify discovery.
  const halfList = Math.ceil(room / 2);
  const halfApify = room - halfList;
  console.log(`[daily-scrape] Room for ${room} new jobs — ~${halfList} from list, ~${halfApify} from Apify.`);

  const existingUrls = await getExistingUrls(supabase);

  // Static list first (free, reliable), then Apify for the remainder.
  const fromList = await harvest(staticBoards(), halfList, existingUrls, 'list');
  console.log(`[daily-scrape] Collected ${fromList.length} from curated list.`);

  let fromApify: PendingJob[] = [];
  const apifyBudget = room - fromList.length; // take leftover room too if list fell short
  if (apifyBudget > 0) {
    const boards = await discoveredBoards();
    console.log(`[daily-scrape] ${boards.length} boards discovered via Apify.`);
    fromApify = await harvest(boards, apifyBudget, existingUrls, 'apify');
    console.log(`[daily-scrape] Collected ${fromApify.length} from Apify discovery.`);
  }

  const inserted = await insertJobs(supabase, [...fromList, ...fromApify]);
  console.log(`[daily-scrape] Done. ${inserted} new jobs inserted (backlog now ~${backlog + inserted}).`);
}

main().catch(err => {
  console.error('[daily-scrape] Fatal:', err);
  process.exit(1);
});
