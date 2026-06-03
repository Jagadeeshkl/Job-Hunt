export function buildMatchingPrompt(resumeJson: object, jdText: string): string {
  return `Analyse this candidate's profile against this job description.

CANDIDATE PROFILE:
${JSON.stringify(resumeJson, null, 2)}

JOB DESCRIPTION:
${jdText}

Return ONLY valid JSON, no markdown, no explanation:
{
  "match_score": <0-100 integer>,
  "matched_skills": ["skill1", "skill2"],
  "missing_skills": ["skill1", "skill2"],
  "match_justification": "3 bullet points max, why this is a good/bad match",
  "ats_keywords_to_add": ["keyword1", "keyword2"],
  "recommended_role_title": "exact title to use on resume"
}`;
}

export const MATCHING_SYSTEM_PROMPT =
  'You are an expert ATS resume analyst and technical recruiter specialising in AI/ML roles.';
