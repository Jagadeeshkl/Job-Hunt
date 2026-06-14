import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/supabase';
import { uploadPdf } from '../../../../lib/storage';

// Receives the browser-rendered resume + cover PDFs, uploads them to Supabase
// Storage (service key, server-side), marks the application approved, and pings
// the n8n webhook. No headless browser involved.
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const id = form.get('id');
  const prefix = (form.get('prefix') as string) || 'document';
  const resume = form.get('resume');
  const cover = form.get('cover');

  if (typeof id !== 'string' || !(resume instanceof File) || !(cover instanceof File)) {
    return NextResponse.json({ error: 'id, resume and cover are required' }, { status: 400 });
  }

  try {
    const resumeBuf = Buffer.from(await resume.arrayBuffer());
    const coverBuf = Buffer.from(await cover.arrayBuffer());

    const [resumeUrl, coverUrl] = await Promise.all([
      uploadPdf(id, `${prefix}-resume.pdf`, resumeBuf),
      uploadPdf(id, `${prefix}-cover-letter.pdf`, coverBuf),
    ]);

    const supabase = getServiceClient();
    const { error: updateErr } = await supabase
      .from('applications')
      .update({
        status: 'approved',
        resume_storage_url: resumeUrl,
        cover_letter_storage_url: coverUrl,
      })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 });
    }

    // Fire n8n webhook (Notion / Telegram) — do not block the response.
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resume_url: resumeUrl, cover_letter_url: coverUrl }),
      }).catch(err => console.error('[approve/save] n8n webhook failed:', err));
    }

    return NextResponse.json({
      ok: true,
      id,
      status: 'approved',
      resume_storage_url: resumeUrl,
      cover_letter_storage_url: coverUrl,
    });
  } catch (err) {
    console.error('[approve/save] failed:', err);
    return NextResponse.json(
      { error: `Saving documents failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
