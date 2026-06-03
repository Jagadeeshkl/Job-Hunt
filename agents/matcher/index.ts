import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { buildMatchingPrompt } from './prompts';
import { generateWithRetry } from '../lib/gemini';
import baseResume from '../resume-generator/base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface MatchResult {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  match_justification: string;
  ats_keywords_to_add: string[];
  recommended_role_title: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function matchJob(jdText: string): Promise<MatchResult | null> {
  try {
    const prompt = buildMatchingPrompt(baseResume, jdText);
    const text = await generateWithRetry(prompt, { tag: 'matcher' });

    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(json) as MatchResult;
  } catch (err: any) {
    console.error('[matcher] Gemini error:', err?.message || err);
    return null;
  }
}

async function main() {
  console.log('[matcher] Fetching unmatched jobs…');

  // Oldest first: yesterday's unscored backlog is prioritised over today's
  // fresh scrapes, so nothing starves when the daily Gemini budget runs out.
  const { data: jobs, error } = await supabase
    .from('applications')
    .select('id, company, role, jd_text')
    .eq('status', 'scraped')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  if (!jobs || jobs.length === 0) {
    console.log('[matcher] No scraped jobs to process.');
    return;
  }

  console.log(`[matcher] Processing ${jobs.length} jobs (oldest first) with Gemini…`);

  let consecutiveFailures = 0;

  for (const job of jobs) {
    if (!job.jd_text) {
      console.warn(`[matcher] Skipping ${job.id}: no JD text`);
      continue;
    }

    const result = await matchJob(job.jd_text);
    if (!result) {
      consecutiveFailures++;
      // The retry helper only returns null after exhausting every model+retry.
      // A run of failures means the whole daily budget is gone — stop hammering
      // the API; the unscored remainder stays 'scraped' and is picked up first
      // (oldest) on the next run once quota resets.
      if (consecutiveFailures >= 3) {
        console.warn('[matcher] Daily Gemini budget appears exhausted — stopping. Remaining jobs will be scored next run.');
        break;
      }
      console.warn(`[matcher] Failed to match job ${job.id}`);
      continue;
    }
    consecutiveFailures = 0;

    const { error: updateErr } = await supabase
      .from('applications')
      .update({
        match_score: result.match_score,
        matched_skills: result.matched_skills,
        missing_skills: result.missing_skills,
        match_justification: result.match_justification,
        status: 'matched',
      })
      .eq('id', job.id);

    if (updateErr) {
      console.error(`[matcher] Update failed for ${job.id}:`, updateErr.message);
    } else {
      console.log(`[matcher] ${job.company} — ${job.role}: score=${result.match_score}`);
    }

    // Stay under free-tier RPM limits (~15/min) with comfortable headroom.
    await sleep(4000);
  }

  console.log('[matcher] Done.');
}

main().catch(err => {
  console.error('[matcher] Fatal:', err);
  process.exit(1);
});
