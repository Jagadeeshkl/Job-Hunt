import * as dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { generateCoverLetter } from './cover-letter';
import { buildResumePdf, buildCoverLetterPdf } from './pdf-builder';
import baseResumeTemplate from './base-resume.json';

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const args = process.argv.slice(2);
const idArg = args.find(a => a.startsWith('--id='));
const applicationId = idArg ? idArg.split('=')[1] : null;

async function tailorResume(application: any, baseResume: any): Promise<any> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction:
      'You are an expert resume writer for AI/ML engineers. You write ATS-optimised resumes that pass automated screening.',
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: 4096,
    },
  });

  const prompt = `Tailor this base resume for this specific job. Inject the ATS keywords naturally. Emphasise matching skills. Keep it honest — do not fabricate experience.

BASE RESUME:
${JSON.stringify(baseResume, null, 2)}

JOB DETAILS:
Company: ${application.company}
Role: ${application.role}
JD Text: ${application.jd_text}
Missing skills (do NOT fabricate these, omit if not present): ${JSON.stringify(application.missing_skills ?? [])}

Return ONLY valid JSON matching this schema:
{
  "name": "",
  "contact": { "email": "", "phone": "", "linkedin": "", "github": "", "location": "" },
  "summary": "3 sentence professional summary with target role and keywords",
  "experience": [{ "company": "", "role": "", "duration": "", "bullets": ["..."] }],
  "skills": { "languages": [], "frameworks": [], "tools": [], "concepts": [] },
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "projects": [{ "name": "", "description": "", "tech": [] }]
}`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
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
