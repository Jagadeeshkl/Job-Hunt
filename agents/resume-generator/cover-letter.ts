import { generateWithRetry } from '../lib/gemini';

export async function generateCoverLetter(params: {
  company: string;
  role: string;
  jdText: string;
  resumeJson: object;
}): Promise<string> {
  const { company, role, jdText, resumeJson } = params;

  const prompt = `Generate a concise, professional cover letter for this application. 3 paragraphs max.

Para 1: Why I'm excited about ${company} specifically (research the company from the JD context).
Para 2: My top 3 relevant achievements that match their requirements.
Para 3: Call to action.

Tone: Confident, direct, not sycophantic.
Do NOT start with "I am writing to apply for..."

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jdText}

CANDIDATE PROFILE:
${JSON.stringify(resumeJson, null, 2)}

Return plain text only, no markdown.`;

  return generateWithRetry(prompt, {
    tag: 'cover-letter',
    systemInstruction:
      'You are an expert cover letter writer for AI/ML engineers. You write confident, direct, non-sycophantic cover letters.',
  });
}
