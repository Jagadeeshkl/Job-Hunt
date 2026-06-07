import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

/** Badge counts for the sidebar: review queue, manual-apply queue, active interviews. */
export async function GET() {
  const supabase = getServiceClient();

  const countOf = async (build: (q: any) => any) => {
    const { count } = await build(
      supabase.from('applications').select('id', { count: 'exact', head: true })
    );
    return count ?? 0;
  };

  const [review, manual, interviews, saved] = await Promise.all([
    countOf(q => q.eq('status', 'matched')),
    countOf(q => q.eq('is_manual_required', true).in('status', ['matched', 'approved'])),
    countOf(q => q.in('status', ['interview_scheduled', 'assessment', 'offer'])),
    countOf(q => q.eq('starred', true)),
  ]);

  return NextResponse.json({ review, manual, interviews, saved });
}
