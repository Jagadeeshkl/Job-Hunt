import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../../.env.local' });

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
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries: query,
        resultsPerPage: 20,
        maxPagesPerQuery: 1,
      }),
    }
  );

  if (!runRes.ok) {
    console.warn(`[apify] Actor run failed: ${runRes.status}`);
    return [];
  }

  const runData: any = await runRes.json();
  const runId = runData?.data?.id;
  if (!runId) return [];

  // Poll until finished (max 60s)
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
    );
    const statusData: any = await statusRes.json();
    if (statusData?.data?.status === 'SUCCEEDED') break;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData?.data?.status ?? '')) {
      console.warn(`[apify] Run ${runId} ended with: ${statusData?.data?.status}`);
      return [];
    }
  }

  const datasetRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_API_TOKEN}&format=json`
  );
  const items: any[] = await datasetRes.json();

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
