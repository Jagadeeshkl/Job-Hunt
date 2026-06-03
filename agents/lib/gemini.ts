import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai';

// Each model name (including the "-latest" aliases) is a SEPARATE free-tier
// daily quota bucket — verified empirically: gemini-2.5-flash-lite can be
// exhausted while gemini-flash-lite-latest still answers. Chaining them
// multiplies the free daily scoring budget from ~20 to ~80-100/day with no
// billing. Ordered cheapest/lightest first (fine for matching & classifying).
const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];
const MAX_RETRIES = 4;

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

// True when a 429 is the per-DAY quota being exhausted (vs a transient per-minute
// rate limit). Google returns a short RetryInfo even for daily exhaustion, so
// waiting is pointless — we should jump to the next model's separate daily bucket.
function isDailyQuotaExhausted(err: any): boolean {
  const qf = err?.errorDetails?.find((d: any) => d['@type']?.includes('QuotaFailure'));
  const viols = qf?.violations ?? [];
  if (viols.some((v: any) => /PerDay/i.test(v?.quotaId ?? ''))) return true;
  // Fall back to the message text when structured details are absent.
  return /per day|PerDay|free_tier.*limit/i.test(err?.message ?? '');
}

export interface GenerateOptions {
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  /** Label used in log lines, e.g. "matcher" or "classifier". */
  tag?: string;
}

/**
 * Generate text from Gemini with free-tier resilience:
 *  - retries 503 (model busy) with exponential backoff
 *  - on 429, respects Google's RetryInfo delay; if the daily cap is hit,
 *    falls through to the next model in MODELS
 * Reads GOOGLE_API_KEY lazily so callers' dotenv.config() has already run.
 * Throws the last error if every model/attempt is exhausted.
 */
export async function generateWithRetry(
  prompt: string,
  opts: GenerateOptions = {}
): Promise<string> {
  const { systemInstruction, generationConfig, tag = 'gemini' } = opts;
  const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

  let lastErr: any;
  for (const modelName of MODELS) {
    const model = genai.getGenerativeModel({
      model: modelName,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(generationConfig ? { generationConfig } : {}),
    });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status;
        if (status === 503) {
          const wait = 2000 * Math.pow(2, attempt);
          console.warn(`[${tag}] ${modelName} 503 (busy), retrying in ${wait / 1000}s…`);
          await sleep(wait);
          continue;
        }
        if (status === 429) {
          // Daily bucket gone — waiting won't help (each model has its own daily
          // quota), so jump straight to the next model.
          if (isDailyQuotaExhausted(err)) {
            console.warn(`[${tag}] ${modelName} daily quota exhausted, switching model…`);
            break;
          }
          // Transient per-minute rate limit — honour Google's short retry delay.
          const delay = retryDelayMs(err);
          if (delay && delay <= 60000) {
            console.warn(`[${tag}] ${modelName} 429 (rate), waiting ${delay / 1000}s…`);
            await sleep(delay);
            continue;
          }
          console.warn(`[${tag}] ${modelName} rate limited, switching model…`);
          break;
        }
        // Unknown error — don't hammer it.
        throw err;
      }
    }
  }
  throw lastErr;
}
