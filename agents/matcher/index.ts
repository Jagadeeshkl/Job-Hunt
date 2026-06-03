import * as dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { buildMatchingPrompt } from './prompts';
import baseResume from '../resume-generator/base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

// flash-lite has the highest free-tier daily quota; flash is the fallback.
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const MAX_RETRIES = 4;

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

// Pull Google's suggested retry delay (seconds) out of a 429 error, if present.
function retryDelayMs(err: any): number | null {
  const info = err?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'));
  if (info?.retryDelay) {
    const secs = parseInt(String(info.retryDelay).replace('s', ''), 10);
    if (!Number.isNaN(secs)) return (secs + 1) * 1000;
  }
  return null;
}

async function generateWithRetry(prompt: string): Promise<string> {
  let lastErr: any;
  for (const modelName of MODELS) {
    const model = genai.getGenerativeModel({ model: modelName });
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status;
        if (status === 503) {
          // Transient overload — exponential backoff, then retry same model.
          const wait = 2000 * Math.pow(2, attempt);
          console.warn(`[matcher] ${modelName} 503 (busy), retrying in ${wait / 1000}s…`);
          await sleep(wait);
          continue;
        }
        if (status === 429) {
          const delay = retryDelayMs(err);
          if (delay && delay <= 60000) {
            console.warn(`[matcher] ${modelName} 429 (rate), waiting ${delay / 1000}s…`);
            await sleep(delay);
            continue;
          }
          // Daily cap hit — stop retrying this model, fall through to next.
          console.warn(`[matcher] ${modelName} daily quota exhausted, switching model…`);
          break;
        }
        // Unknown error — don't hammer it.
        throw err;
      }
    }
  }
  throw lastErr;
}

async function matchJob(jdText: string): Promise<MatchResult | null> {
  try {
    const prompt = buildMatchingPrompt(baseResume, jdText);
    const text = await generateWithRetry(prompt);

    const json = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    return JSON.parse(json) as MatchResult;
  } catch (err: any) {
    console.error('[matcher] Gemini error:', err?.message || err);
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

  console.log(`[matcher] Processing ${jobs.length} jobs with ${MODELS[0]}…`);

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

    // Stay under free-tier RPM limits (~15/min) with comfortable headroom.
    await sleep(4000);
  }

  console.log('[matcher] Done.');
}

main().catch(err => {
  console.error('[matcher] Fatal:', err);
  process.exit(1);
});
