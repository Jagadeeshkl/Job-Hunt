import fetch from 'node-fetch';
import type { JobListing } from './greenhouse';

const AI_KEYWORDS = [
  'AI', 'ML', 'Machine Learning', 'GenAI', 'LLM', 'NLP',
  'Computer Vision', 'Data Scientist', 'MLOps', 'AI Engineer',
  'Research Scientist', 'Deep Learning', 'Generative', 'Foundation Model'
];

function matchesAiKeywords(title: string): boolean {
  const lower = title.toLowerCase();
  return AI_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

export async function fetchAshbyJobs(
  companyName: string,
  atsId: string
): Promise<JobListing[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${atsId}`;

  let data: any;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JobAgentBot/1.0' },
    });
    if (!res.ok) {
      console.warn(`[ashby] ${companyName}: HTTP ${res.status}`);
      return [];
    }
    data = await res.json();
  } catch (err) {
    console.warn(`[ashby] ${companyName}: fetch error`, err);
    return [];
  }

  const jobs: any[] = data?.jobPostings ?? [];
  const results: JobListing[] = [];

  for (const job of jobs) {
    if (!matchesAiKeywords(job.title ?? '')) continue;

    const jdText = job.descriptionPlain ?? job.description ?? '';
    const location =
      job.isRemote
        ? 'Remote'
        : job.locationName ?? job.location ?? 'Unknown';

    results.push({
      company: companyName,
      role: job.title,
      jd_url:
        job.jobUrl ??
        `https://jobs.ashbyhq.com/${atsId}/${job.id}`,
      jd_text: jdText,
      ats_type: 'greenhouse', // normalised; caller sets actual ats_type
      location,
      salary_range:
        job.compensationTierSummary ?? null,
    });
  }

  return results;
}
