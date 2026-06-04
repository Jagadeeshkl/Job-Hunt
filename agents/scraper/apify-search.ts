import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
const ACTOR_ID = 'apify~google-search-scraper';

const DISCOVERY_QUERIES = [
  'site:boards.greenhouse.io ("AI Engineer" OR "GenAI" OR "Machine Learning" OR "LLM Engineer" OR "MLOps") ("Bengaluru" OR "Bangalore" OR "Chennai" OR "India")',
  'site:jobs.lever.co ("AI Engineer" OR "GenAI" OR "Machine Learning" OR "LLM Engineer" OR "MLOps") ("Bengaluru" OR "Bangalore" OR "Chennai" OR "India")',
  'site:jobs.ashbyhq.com ("AI Engineer" OR "GenAI" OR "Machine Learning" OR "LLM Engineer" OR "MLOps") ("Bengaluru" OR "Bangalore" OR "Chennai" OR "India")',
];

interface DiscoveredJob {
  company: string;
  ats: 'greenhouse' | 'lever' | 'ashby';
  ats_id: string;
  job_url: string;
}

function parseGreenhouseUrl(url: string): { ats_id: string; job_url: string } | null {
  const m = url.match(/boards\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  return { ats_id: m[1], job_url: url };
}

function parseLeverUrl(url: string): { ats_id: string; job_url: string } | null {
  const m = url.match(/jobs\.lever\.co\/([^/]+)\//);
  if (!m) return null;
  return { ats_id: m[1], job_url: url };
}

function parseAshbyUrl(url: string): { ats_id: string; job_url: string } | null {
  const m = url.match(/jobs\.ashbyhq\.com\/([^/]+)\//);
  if (!m) return null;
  return { ats_id: m[1], job_url: url };
}

async function runApifyActor(query: string): Promise<string[]> {
  // run-sync-get-dataset-items blocks until the run finishes and returns the
  // dataset directly — simpler and more reliable than creating a run + polling.
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // `resultsPerPage` is NOT a valid field for this actor and was silently
        // ignored, capping every query at a single page (~10 results). Each page
        // is ~10 results, so maxPagesPerQuery: 3 yields ~30 candidate URLs/query.
        queries: query,
        maxPagesPerQuery: 3,
      }),
    }
  );

  if (!res.ok) {
    console.warn(`[apify] Actor run failed: ${res.status}`);
    return [];
  }

  const items: any[] = await res.json();

  return items.flatMap((item: any) =>
    (item.organicResults ?? []).map((r: any) => r.url as string).filter(Boolean)
  );
}

export async function discoverNewJobs(dryRun = false): Promise<DiscoveredJob[]> {
  if (dryRun) {
    console.log('[apify] dry-run: skipping Apify calls');
    return [];
  }

  const discovered: DiscoveredJob[] = [];
  const seen = new Set<string>();

  for (const query of DISCOVERY_QUERIES) {
    console.log(`[apify] querying: ${query}`);
    const urls = await runApifyActor(query);

    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);

      const gh = parseGreenhouseUrl(url);
      if (gh) {
        discovered.push({ company: gh.ats_id, ats: 'greenhouse', ...gh });
        continue;
      }
      const lv = parseLeverUrl(url);
      if (lv) {
        discovered.push({ company: lv.ats_id, ats: 'lever', ...lv });
        continue;
      }
      const ab = parseAshbyUrl(url);
      if (ab) {
        discovered.push({ company: ab.ats_id, ats: 'ashby', ...ab });
      }
    }
  }

  console.log(`[apify] discovered ${discovered.length} new job URLs`);
  return discovered;
}
