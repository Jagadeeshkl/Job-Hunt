import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../../lib/supabase';

/**
 * Update a single application — used by the Review queue (Skip/Reject/Save),
 * Manual Apply (Mark applied), and the Interviews board (stage changes).
 * Body: { status?: string, starred?: boolean, applied_at?: string|null }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.status === 'string') patch.status = body.status;
  if (typeof body.starred === 'boolean') patch.starred = body.starred;
  if ('applied_at' in body) patch.applied_at = body.applied_at;

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('applications')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data });
}
