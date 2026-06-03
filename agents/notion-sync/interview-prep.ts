import { GoogleGenerativeAI } from '@google/generative-ai';

const genai = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });

export async function generateInterviewQuestions(
  missingSkills: string[]
): Promise<string> {
  if (missingSkills.length === 0) return '';

  try {
    const result = await model.generateContent(
      `For each of the following missing skills, generate 3 interview questions a senior interviewer would ask. Format as a clean markdown bullet list grouped by skill.

Skills: ${missingSkills.join(', ')}`
    );
    return result.response.text();
  } catch (err) {
    console.error('[interview-prep] Gemini error:', err);
    return '';
  }
}
