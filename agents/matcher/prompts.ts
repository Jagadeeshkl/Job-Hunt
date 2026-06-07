export function buildMatchingPrompt(resumeJson: object, jdText: string): string {
  return `Score this candidate against the job across 6 dimensions.

CANDIDATE PROFILE:
${JSON.stringify(resumeJson, null, 2)}

JOB DESCRIPTION:
${jdText}

Return ONLY valid JSON (no markdown). Each dimension score is an integer 0-100 with a one-line reason:
{
  "dimensions": {
    "stack_fit":    {"score": 0, "reason": ""},
    "seniority":    {"score": 0, "reason": ""},
    "location":     {"score": 0, "reason": ""},
    "compensation": {"score": 0, "reason": ""},
    "evidence":     {"score": 0, "reason": ""},
    "mission":      {"score": 0, "reason": ""}
  },
  "matched_skills": [],
  "missing_skills": []
}`;
}

export const MATCHING_SYSTEM_PROMPT =
  'You are an expert ATS resume analyst and technical recruiter specialising in AI/ML roles.';
