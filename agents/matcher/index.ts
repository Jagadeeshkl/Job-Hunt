import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { buildMatchingPrompt } from './prompts';
import { generateWithRetry } from '../lib/gemini';
import { gateReason } from '../scraper/quality-gate';
import baseResume from '../resume-generator/base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const WEIGHTS: Record<string, number> = { stack_fit: 0.30, evidence: 0.20, seniority: 0.20, mission: 0.15, location: 0.10, compensation: 0.05 };
const DIMS = ['stack_fit', 'seniority', 'location', 'compensation', 'evidence', 'mission'];
const clamp = (n: any) => { n = Number(n); return isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface MatchResult {
  match_score: number;
  score_breakdown: Record<string, { score: number; reason: string }>;
  matched_skills: string[];
  missing_skills: string[];
  match_justification: string;
  status: 'matched' | 'filtered';
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function matchJob(jdText: string): Promise<MatchResult | null> {
  try {
    const prompt = buildMatchingPrompt(baseResume, jdText);
    const text = await generateWithRetry(prompt, { tag: 'matcher' });

    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const p = JSON.parse(json);
    const d = p.dimensions || {};
    const breakdown: Record<string, { score: number; reason: string }> = {};
    let overall = 0;
    for (const k of DIMS) {
      const score = clamp(d[k] && d[k].score);
      breakdown[k] = { score, reason: (d[k] && typeof d[k].reason === 'string') ? d[k].reason : '' };
      overall += (WEIGHTS[k] || 0) * score;
    }
    overall = Math.round(overall);
    const matched = overall >= 60;
    const justification = DIMS.map(k => ({ k, r: breakdown[k].reason })).filter(x => x.r).map(x => `${x.k.replace('_', ' ')}: ${x.r}`).join('\n');
    return {
      match_score: overall,
      score_breakdown: breakdown,
      matched_skills: p.matched_skills || [],
      missing_skills: p.missing_skills || [],
      match_justification: matched ? justification : `Below threshold (${overall})`,
      status: matched ? 'matched' : 'filtered',
    };
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

    // Deterministic quality gate — drop senior/thin/spam before Gemini.
    const reason = gateReason(job.role, job.jd_text);
    if (reason) {
      await supabase.from('applications')
        .update({ status: 'filtered', match_justification: `Filtered: ${reason}` })
        .eq('id', job.id);
      console.log(`[matcher] gated ${job.company}: ${reason}`);
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
        score_breakdown: result.score_breakdown,
        matched_skills: result.matched_skills,
        missing_skills: result.missing_skills,
        match_justification: result.match_justification,
        status: result.status,
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
