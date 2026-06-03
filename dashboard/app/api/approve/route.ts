import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

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

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'N8N_WEBHOOK_URL not configured' }, { status: 500 });
  }

  // Fire n8n webhook asynchronously — do not await
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: app.id, company: app.company, role: app.role }),
  }).catch(err => console.error('[approve] n8n webhook failed:', err));

  return NextResponse.json({ ok: true, id: app.id });
}
