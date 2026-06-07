import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';
import { loadBaseResume } from '../../../lib/base-resume';
import { tailorForJob } from '../../../lib/tailor';
import { renderResumeHTML } from '../../../lib/resume-template';
import { renderCoverLetterHTML } from '../../../lib/cover-letter-template';
import { htmlToPdf } from '../../../lib/render-pdf';
import { uploadPdf } from '../../../lib/storage';

// Needs the Node runtime: spawns a headless browser and uses fs.
export const runtime = 'nodejs';
export const maxDuration = 60;

function slug(s: string): string {
  return (s || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';
}

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: app, error } = await supabase
    .from('applications')
    .select('id, company, role, jd_text, missing_skills')
    .eq('id', id)
    .single();

  if (error || !app) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  try {
    // 1) Tailor (Gemini) → 2) fill locked templates → 3) render PDFs
    const base = await loadBaseResume();
    const { resume, cover } = await tailorForJob(base, {
      company: app.company,
      role: app.role,
      jdText: app.jd_text,
      missingSkills: app.missing_skills,
    });

    const resumeHtml = renderResumeHTML(base, resume);
    const coverHtml = renderCoverLetterHTML(base, cover);

    const [resumePdf, coverPdf] = await Promise.all([
      htmlToPdf(resumeHtml),
      htmlToPdf(coverHtml),
    ]);

    // 4) Upload to Supabase Storage
    const prefix = `${slug(app.company)}-${app.role ? slug(app.role) : 'role'}`;
    const [resumeUrl, coverUrl] = await Promise.all([
      uploadPdf(String(app.id), `${prefix}-resume.pdf`, resumePdf),
      uploadPdf(String(app.id), `${prefix}-cover-letter.pdf`, coverPdf),
    ]);

    // 5) Mark approved + attach document URLs
    const { error: updateErr } = await supabase
      .from('applications')
      .update({
        status: 'approved',
        resume_storage_url: resumeUrl,
        cover_letter_storage_url: coverUrl,
      })
      .eq('id', app.id);

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 });
    }

    // 6) Fire n8n webhook (Notion / Telegram) — do not block the response.
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: app.id,
          company: app.company,
          role: app.role,
          resume_url: resumeUrl,
          cover_letter_url: coverUrl,
        }),
      }).catch(err => console.error('[approve] n8n webhook failed:', err));
    }

    return NextResponse.json({
      ok: true,
      id: app.id,
      status: 'approved',
      resume_storage_url: resumeUrl,
      cover_letter_storage_url: coverUrl,
    });
  } catch (err) {
    console.error('[approve] generation failed:', err);
    return NextResponse.json(
      { error: `Document generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
