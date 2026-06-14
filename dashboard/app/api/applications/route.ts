import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

export async function GET(req: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);

  const id = searchParams.get('id');
  const status = searchParams.get('status');
  const minScore = searchParams.get('minScore');
  const maxScore = searchParams.get('maxScore');
  const search = searchParams.get('search');
  const manual = searchParams.get('manual');
  const starred = searchParams.get('starred');

  // Single application lookup (for polling)
  if (id) {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ application: data });
  }

  // List with filters
  let query = supabase
    .from('applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  } else {
    // Default view: exclude dismissed/filtered in SQL *before* the row cap, so
    // the cap applies to meaningful rows. Otherwise the newest 200 rows (mostly
    // filtered noise) get JS-filtered down to a handful and genuine applied/
    // matched jobs past row 200 silently disappear from the dashboard.
    query = query.not('status', 'in', '(dismissed,filtered)');
  }
  if (minScore) query = query.gte('match_score', parseInt(minScore));
  if (maxScore) query = query.lte('match_score', parseInt(maxScore));
  if (search) query = query.ilike('company', `%${search}%`);
  if (manual === 'true') query = query.eq('is_manual_required', true);

  query = query.limit(200);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let apps = data ?? [];
  if (starred === 'true') apps = apps.filter((a: any) => a.starred === true);

  return NextResponse.json({ applications: apps });
}
