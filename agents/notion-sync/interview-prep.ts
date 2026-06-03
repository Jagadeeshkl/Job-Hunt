import { generateWithRetry } from '../lib/gemini';

export async function generateInterviewQuestions(
  missingSkills: string[]
): Promise<string> {
  if (missingSkills.length === 0) return '';

  try {
    return await generateWithRetry(
      `For each of the following missing skills, generate 3 interview questions a senior interviewer would ask. Format as a clean markdown bullet list grouped by skill.

Skills: ${missingSkills.join(', ')}`,
      { tag: 'interview-prep' }
    );
  } catch (err) {
    console.error('[interview-prep] Gemini error:', err);
    return '';
  }
}
