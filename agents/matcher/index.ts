import * as dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { buildMatchingPrompt } from './prompts';
import baseResume from '../resume-generator/base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

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

async function matchJob(jdText: string): Promise<MatchResult | null> {
  try {
    const prompt = buildMatchingPrompt(baseResume, jdText);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code fences if present
    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(json) as MatchResult;
  } catch (err) {
    console.error('[matcher] Gemini error:', err);
    return null;
  }
}

async function main() {
  console.log('[matcher] Fetching unmatched jobs…');

  const { data: jobs, error } = await supabase
    .from('applications')
    .select('id, company, role, jd_text')
    .eq('status', 'scraped');

  if (error) throw new Error(error.message);
  if (!jobs || jobs.length === 0) {
    console.log('[matcher] No scraped jobs to process.');
    return;
  }

  console.log(`[matcher] Processing ${jobs.length} jobs with Gemini Flash…`);

  for (const job of jobs) {
    if (!job.jd_text) {
      console.warn(`[matcher] Skipping ${job.id}: no JD text`);
      continue;
    }

    const result = await matchJob(job.jd_text);
    if (!result) {
      console.warn(`[matcher] Failed to match job ${job.id}`);
      continue;
    }

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

    // Stay within free tier rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('[matcher] Done.');
}

main().catch(err => {
  console.error('[matcher] Fatal:', err);
  process.exit(1);
});
