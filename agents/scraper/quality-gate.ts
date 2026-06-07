// Shared deterministic quality gate (parity with cloud WF01 Quality Gate node).
// Returns a filter reason if the job should be gated before Gemini, else null.
const SENIOR = /\b(staff|principal|lead|director|vp|vice president|head|manager)\b/i;
const SPAM = /(unpaid|commission only|mlm|pyramid)/i;
const AI_KW = ['ai', 'ml', 'machine learning', 'genai', 'llm', 'nlp', 'computer vision', 'data scientist', 'mlops', 'ai engineer', 'research scientist', 'deep learning', 'generative', 'foundation model', 'data science'];
const MIN_JD = 300;
const hasAI = (t: string) => { const l = (t || '').toLowerCase(); return AI_KW.some(k => l.includes(k)); };

/** Returns a filter reason string if the job should be gated, else null. */
export function gateReason(role: string, jdText: string): string | null {
  if (SENIOR.test(role || '')) return 'senior-only title';
  if ((jdText || '').length < MIN_JD) return 'thin description';
  if (SPAM.test(jdText || '') || SPAM.test(role || '')) return 'spam';
  if (!hasAI(role || '') && !hasAI(jdText || '')) return 'non-target (no AI/ML keywords)';
  return null;
}
