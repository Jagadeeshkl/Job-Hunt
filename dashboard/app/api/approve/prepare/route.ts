import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/supabase';
import { loadBaseResume } from '../../../../lib/base-resume';
import { tailorForJob } from '../../../../lib/tailor';
import { renderResumeHTML } from '../../../../lib/resume-template';
import { renderCoverLetterHTML } from '../../../../lib/cover-letter-template';

// Tailors the resume + cover (Gemini) and returns print-ready HTML. The browser
// renders the HTML to PDF (see lib/generate-docs.ts), so this route never needs
// a headless browser — keeping it Vercel-serverless friendly.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function slug(s: string): string {
  return (
    (s || 'company')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'company'
  );
}

export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}));
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
    const base = await loadBaseResume();
    const { resume, cover } = await tailorForJob(base, {
      company: app.company,
      role: app.role,
      jdText: app.jd_text,
      missingSkills: app.missing_skills,
    });

    const resumeHtml = renderResumeHTML(base, resume);
    const coverHtml = renderCoverLetterHTML(base, cover);
    const prefix = `${slug(app.company)}-${app.role ? slug(app.role) : 'role'}`;

    return NextResponse.json({ ok: true, id: app.id, prefix, resumeHtml, coverHtml });
  } catch (err) {
    console.error('[approve/prepare] tailoring failed:', err);
    return NextResponse.json(
      { error: `Tailoring failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
