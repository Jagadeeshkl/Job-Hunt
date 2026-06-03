import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { generateCoverLetter } from './cover-letter';
import { buildResumePdf, buildCoverLetterPdf } from './pdf-builder';
import { generateWithRetry } from '../lib/gemini';
import baseResumeTemplate from './base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--id='));
const applicationId = idArg ? idArg.split('=')[1] : null;

async function tailorResume(application: any, baseResume: any): Promise<any> {
  const prompt = `Tailor this base resume for this specific job so it passes automated ATS screening.

BASE RESUME:
${JSON.stringify(baseResume, null, 2)}

JOB DETAILS:
Company: ${application.company}
Role: ${application.role}
JD Text: ${application.jd_text}
Missing skills (do NOT fabricate these, omit if not present): ${JSON.stringify(application.missing_skills ?? [])}

HARD RULES:
1. TOTAL EXPERIENCE = exactly 2 years. Always present the candidate as having ~2 years of
   experience, regardless of what the job description asks for. Even if the JD requires 5+
   years, frame the candidate as a strong 2-year-experience engineer. Never state more or
   less than 2 years. Keep job durations consistent with a ~2 year total.
2. ATS OPTIMISATION — this resume must pass keyword-based Applicant Tracking Systems:
   - Mirror the EXACT keywords, skills, and tool names from the JD verbatim where the
     candidate genuinely has them (match the JD's spelling/casing, e.g. "PyTorch", "LLMs").
   - Use standard section headings (Summary, Experience, Skills, Education, Projects).
   - Put hard skills as plain comma-free list items, no tables/columns/graphics.
   - Weave the role's top 8-10 keywords across summary, skills, and experience bullets.
   - Start each experience bullet with a strong action verb + a quantified result.
3. HONESTY: do not invent employers, degrees, or skills the candidate lacks. You may
   re-frame and re-emphasise real experience, but not fabricate it (the 2-year framing
   is the one allowed normalisation).

Return ONLY valid JSON matching this schema:
{
  "name": "",
  "contact": { "email": "", "phone": "", "linkedin": "", "github": "", "location": "" },
  "summary": "3 sentence professional summary stating ~2 years experience, the target role, and top JD keywords",
  "experience": [{ "company": "", "role": "", "duration": "", "bullets": ["action verb + quantified result + JD keyword"] }],
  "skills": { "languages": [], "frameworks": [], "tools": [], "concepts": [] },
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "projects": [{ "name": "", "description": "", "tech": [] }]
}`;

  const text = await generateWithRetry(prompt, {
    tag: 'resume-gen',
    systemInstruction:
      'You are an expert resume writer for AI/ML engineers. You write ATS-optimised resumes that reliably pass automated keyword screening, always presenting the candidate as having exactly 2 years of experience.',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
    },
  });
  return JSON.parse(text);
}

async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('resumes')
    .upload(filename, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from('resumes')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

async function main() {
  if (!applicationId) {
    console.error('[resume-gen] --id=<uuid> is required');
    process.exit(1);
  }

  console.log(`[resume-gen] Processing application ${applicationId}…`);

  const { data: app, error } = await supabase
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (error || !app) {
    console.error('[resume-gen] Application not found:', error?.message);
    process.exit(1);
  }

  const baseResume = { ...baseResumeTemplate };
  delete (baseResume as any)._instruction;

  console.log('[resume-gen] Tailoring resume via Gemini…');
  const tailoredResume = await tailorResume(app, baseResume);

  console.log('[resume-gen] Generating cover letter…');
  const coverLetterText = await generateCoverLetter({
    company: app.company,
    role: app.role,
    jdText: app.jd_text,
    resumeJson: tailoredResume,
  });

  console.log('[resume-gen] Building PDFs…');
  const resumePdf = await buildResumePdf(tailoredResume);
  const coverLetterPdf = await buildCoverLetterPdf(
    coverLetterText,
    tailoredResume.name,
    app.company,
    app.role
  );

  const timestamp = Date.now();
  const safeCompany = app.company.replace(/[^a-z0-9]/gi, '-').toLowerCase();

  console.log('[resume-gen] Uploading to Supabase Storage…');
  const resumeUrl = await uploadToStorage(
    resumePdf,
    `${safeCompany}-${timestamp}-resume.pdf`,
    'application/pdf'
  );
  const coverLetterUrl = await uploadToStorage(
    coverLetterPdf,
    `${safeCompany}-${timestamp}-cover-letter.pdf`,
    'application/pdf'
  );

  await supabase
    .from('applications')
    .update({
      resume_storage_url: resumeUrl,
      cover_letter_storage_url: coverLetterUrl,
      status: 'approved',
    })
    .eq('id', applicationId);

  console.log(`[resume-gen] Done. Resume: ${resumeUrl}`);
}

main().catch(err => {
  console.error('[resume-gen] Fatal:', err);
  process.exit(1);
});
