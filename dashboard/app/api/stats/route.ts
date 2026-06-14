import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

// Live data — never statically evaluated/cached at build time.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServiceClient();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, weekRes, interviewRes, appliedRes, positiveRes, last14Res, statusRes] =
    await Promise.all([
      supabase.from('applications').select('*', { count: 'exact', head: true }),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied').gte('applied_at', weekAgo),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'interview_scheduled'),
      supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'applied'),
      supabase.from('applications').select('*', { count: 'exact', head: true }).in('status', ['interview_scheduled', 'assessment', 'offer']),
      supabase.from('applications').select('applied_at').eq('status', 'applied').gte('applied_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('applications').select('status'),
    ]);

  const totalApplied = appliedRes.count ?? 0;
  const positiveOutcomes = positiveRes.count ?? 0;
  const responseRate = totalApplied > 0 ? (positiveOutcomes / totalApplied) * 100 : 0;

  // Applications per day (last 14 days)
  const perDay: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    perDay[d.toISOString().split('T')[0]] = 0;
  }
  for (const row of last14Res.data ?? []) {
    if (row.applied_at) {
      const day = row.applied_at.split('T')[0];
      if (day in perDay) perDay[day]++;
    }
  }
  const dailyChart = Object.entries(perDay).map(([date, count]) => ({ date, count }));

  // Status distribution
  const statusCount: Record<string, number> = {};
  for (const row of statusRes.data ?? []) {
    statusCount[row.status] = (statusCount[row.status] ?? 0) + 1;
  }
  const statusChart = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  return NextResponse.json({
    totalScraped: totalRes.count ?? 0,
    appliedThisWeek: weekRes.count ?? 0,
    activeInterviews: interviewRes.count ?? 0,
    responseRate,
    dailyChart,
    statusChart,
  });
}
