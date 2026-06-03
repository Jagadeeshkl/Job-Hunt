import { createClient } from '@supabase/supabase-js';
import { fetchGreenhouseJobs, type JobListing } from './greenhouse';
import { fetchLeverJobs } from './lever';
import { fetchAshbyJobs } from './ashby';

export type Ats = 'greenhouse' | 'lever' | 'ashby';

export const TARGET_LOCATIONS = [
  'chennai', 'bangalore', 'bengaluru', 'karnataka', 'tamil nadu', 'remote', 'india',
];

export function supabaseClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export function isTargetLocation(location: string): boolean {
  const lower = (location ?? '').toLowerCase();
  return TARGET_LOCATIONS.some(loc => lower.includes(loc));
}

export async function getExistingUrls(supabase: ReturnType<typeof supabaseClient>): Promise<Set<string>> {
  const { data, error } = await supabase.from('applications').select('jd_url');
  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return new Set((data ?? []).map((r: any) => r.jd_url as string));
}

export async function backlogCount(supabase: ReturnType<typeof supabaseClient>): Promise<number> {
  const { count, error } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'scraped');
  if (error) throw new Error(`Supabase count error: ${error.message}`);
  return count ?? 0;
}

export async function fetchBoard(ats: Ats, atsId: string, company: string): Promise<JobListing[]> {
  if (ats === 'greenhouse') return fetchGreenhouseJobs(company, atsId);
  if (ats === 'lever') return fetchLeverJobs(company, atsId);
  return fetchAshbyJobs(company, atsId);
}

export interface PendingJob extends JobListing {
  _ats: Ats;
}

export async function insertJobs(
  supabase: ReturnType<typeof supabaseClient>,
  jobs: PendingJob[]
): Promise<number> {
  if (jobs.length === 0) return 0;
  const rows = jobs.map(j => ({
    company: j.company,
    role: j.role,
    jd_url: j.jd_url,
    jd_text: j.jd_text,
    location: j.location,
    salary_range: j.salary_range,
    ats_type: j._ats, // DB enum accepts greenhouse | lever | ashby
    status: 'scraped',
  }));
  const { error } = await supabase.from('applications').insert(rows);
  if (error) {
    console.error('[store] insert error:', error.message);
    return 0;
  }
  return rows.length;
}

// Turn an ats_id slug into a readable company name: "jazzx-ai" -> "Jazzx Ai".
export function prettyName(slug: string): string {
  return slug
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
