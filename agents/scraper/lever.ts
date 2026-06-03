import fetch from 'node-fetch';
import { MIN_JD_TEXT_CHARS, type JobListing } from './greenhouse';

const AI_KEYWORDS = [
  'AI', 'ML', 'Machine Learning', 'GenAI', 'LLM', 'NLP',
  'Computer Vision', 'Data Scientist', 'MLOps', 'AI Engineer',
  'Research Scientist', 'Deep Learning', 'Generative', 'Foundation Model'
];

function matchesAiKeywords(title: string): boolean {
  const lower = title.toLowerCase();
  return AI_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

function extractText(lists: any[]): string {
  if (!Array.isArray(lists)) return '';
  return lists
    .map((l: any) => {
      const header = l.text ? `${l.text}: ` : '';
      const items = Array.isArray(l.content) ? l.content.join('. ') : '';
      return header + items;
    })
    .join('\n');
}

export async function fetchLeverJobs(
  companyName: string,
  atsId: string
): Promise<JobListing[]> {
  const url = `https://api.lever.co/v0/postings/${atsId}?mode=json`;

  let data: any[];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'JobAgentBot/1.0' } });
    if (!res.ok) {
      console.warn(`[lever] ${companyName}: HTTP ${res.status}`);
      return [];
    }
    data = await res.json();
  } catch (err) {
    console.warn(`[lever] ${companyName}: fetch error`, err);
    return [];
  }

  if (!Array.isArray(data)) return [];

  const results: JobListing[] = [];

  for (const job of data) {
    if (!matchesAiKeywords(job.text ?? '')) continue;

    const description = job.descriptionPlain ?? job.description ?? '';
    const lists = extractText(job.lists ?? []);
    const jdText = [description, lists].filter(Boolean).join('\n\n');
    if (jdText.length < MIN_JD_TEXT_CHARS) continue; // skip thin/un-tailorable JDs

    results.push({
      company: companyName,
      role: job.text,
      jd_url: job.hostedUrl ?? `https://jobs.lever.co/${atsId}/${job.id}`,
      jd_text: jdText,
      ats_type: 'greenhouse', // stored as 'greenhouse' default; caller sets ats_type
      location: job.categories?.location ?? 'Unknown',
      salary_range: job.salaryRange
        ? `${job.salaryRange.min}-${job.salaryRange.max} ${job.salaryRange.currency ?? ''}`
        : null,
    });
  }

  return results;
}
