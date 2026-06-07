// Minimal, dependency-free Gemini client for the dashboard (server-side only).
// Mirrors the agents' free-tier fallback chain: each model name is a separate
// daily quota bucket, so on a 429 we jump to the next model. Calls the REST API
// directly via fetch — no @google/generative-ai dependency needed.

const MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface GenerateOptions {
  systemInstruction?: string;
  /** Forwarded to the API's generationConfig (e.g. responseMimeType). */
  generationConfig?: Record<string, unknown>;
  tag?: string;
}

export async function generateWithRetry(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const { systemInstruction, generationConfig, tag = 'gemini' } = opts;
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY not configured');

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    ...(generationConfig ? { generationConfig } : {}),
  };

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status === 503) {
        console.warn(`[${tag}] ${model} ${res.status} — switching model…`);
        lastErr = new Error(`${model} ${res.status}`);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Gemini ${res.status}: ${txt.slice(0, 300)}`);
      }

      const json = await res.json();
      const text: string | undefined = json?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('')
        .trim();
      if (text) return text;
      lastErr = new Error(`${model} returned no text`);
    } catch (err) {
      lastErr = err;
      console.warn(`[${tag}] ${model} error:`, (err as Error).message);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini generation failed');
}

/** Parse a JSON object out of a model response that may be fenced in ```json. */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
