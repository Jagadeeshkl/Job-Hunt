// Per-job tailoring: asks Gemini to set the headline, rewrite the profile
// summary framing, order the projects, and write the cover-letter body — using
// ONLY facts already present in the base resume. Falls back to sensible defaults
// if Gemini is unavailable so the Approve flow never hard-fails.

import { generateWithRetry, parseJsonResponse } from './gemini';
import type { BaseResume, ResumeTailoring } from './resume-template';
import type { CoverLetterTailoring } from './cover-letter-template';

export interface JobContext {
  company: string;
  role: string;
  jdText?: string | null;
  missingSkills?: string[] | null;
}

interface TailorResult {
  headline: string;
  summary: string;
  project_order: string[];
  cover_letter_paragraphs: string[];
}

function todayLong(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Keep the headline simple and AI/ML-focused: no years-of-experience, seniority,
// or "production" wording (per the user's locked preference). If Gemini slips any
// of that in, fall back to a clean default.
function cleanHeadline(h?: string): string {
  const t = (h || '').trim();
  if (!t || /year|experience|production|senior|junior|\d/i.test(t)) return 'AI/ML Engineer';
  return t;
}

const SYSTEM =
  'You are an expert technical resume writer and career coach for AI/ML roles. ' +
  'You tailor an existing resume to a specific job WITHOUT inventing any facts, ' +
  'employers, dates, metrics, or skills. You only reframe wording and ordering.';

function buildPrompt(base: BaseResume, job: JobContext): string {
  const projectNames = base.projects.map(p => p.name);
  return `Tailor this candidate's resume and write a cover letter for the target job.

CANDIDATE RESUME (the ONLY facts you may use — never add new ones):
${JSON.stringify(base, null, 2)}

TARGET JOB:
Company: ${job.company}
Role: ${job.role}
${job.missingSkills?.length ? `Skills the candidate is light on: ${job.missingSkills.join(', ')}` : ''}
Job description:
${(job.jdText || '').slice(0, 6000)}

Return ONLY valid JSON (no markdown) in exactly this shape:
{
  "headline": "<short, simple AI/ML role title under the name. MUST be centred on AI/ML (e.g. 'AI/ML Engineer', 'Machine Learning Engineer', 'AI/ML Engineer — Data Science'). Do NOT mention years of experience, seniority words, or the word 'production'. Keep it to a few words.>",
  "summary": "<3-4 sentence profile summary, reframed for this role, using ONLY existing facts>",
  "project_order": [<the project names from this list, most-relevant first: ${JSON.stringify(projectNames)}>],
  "cover_letter_paragraphs": [
    "<opening: interest in the {role} at {company} + who the candidate is>",
    "<current experience paragraph (Cognizant / data-science) tied to the role>",
    "<projects paragraph highlighting the most relevant work and outcomes>",
    "<why THIS company specifically — reference its product/mission/domain from the JD>",
    "<closing: thank you + call to discuss>"
  ]
}`;
}

export async function tailorForJob(
  base: BaseResume,
  job: JobContext
): Promise<{ resume: ResumeTailoring; cover: CoverLetterTailoring }> {
  let parsed: TailorResult | null = null;
  try {
    const text = await generateWithRetry(buildPrompt(base, job), {
      systemInstruction: SYSTEM,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      tag: 'tailor',
    });
    parsed = parseJsonResponse<TailorResult>(text);
  } catch (err) {
    console.warn('[tailor] Gemini tailoring failed, using fallback:', (err as Error).message);
  }

  const headline = cleanHeadline(parsed?.headline);
  const summary = parsed?.summary?.trim() || base.summary;
  const projectOrder = parsed?.project_order?.length ? parsed.project_order : undefined;

  const paragraphs =
    parsed?.cover_letter_paragraphs?.length
      ? parsed.cover_letter_paragraphs
      : [
          `I am writing to express my strong interest in the ${job.role} role at ${job.company}. As an AI & Data Science graduate with hands-on experience building machine-learning and LLM-based solutions, I am excited to contribute my skills to your team.`,
          `In my current role at Cognizant and during my data-science internship, I have built and shipped end-to-end ML and enterprise solutions using Python, TensorFlow, and modern AI tooling.`,
          `My projects — an LLM medical chatbot (90% accuracy), an LSTM stock-price forecaster (86% accuracy), and an assistive LipNet communication tool — reflect my focus on shipping reliable, high-impact results.`,
          `I am drawn to ${job.company} and would welcome the opportunity to bring my AI/ML background to your work.`,
          `Thank you for your time and consideration. I look forward to the possibility of contributing to ${job.company}.`,
        ];

  return {
    resume: { headline, summary, projectOrder },
    cover: {
      headline,
      date: todayLong(),
      company: job.company,
      roleTitle: job.role,
      paragraphs,
    },
  };
}
