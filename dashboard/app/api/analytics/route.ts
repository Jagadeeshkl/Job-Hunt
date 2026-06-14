import { NextResponse } from 'next/server';
import { getServiceClient } from '../../../lib/supabase';

// Live data — never statically evaluated/cached at build time.
export const dynamic = 'force-dynamic';

/** Aggregations for the Analytics page: conversion funnel, source mix, score histogram. */
export async function GET() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('applications')
    .select('status, ats_type, match_score');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const rows = data ?? [];

  const has = (s: string) => rows.filter(r => r.status === s).length;
  const total = rows.length;
  const matched = rows.filter(r => ['matched', 'approved', 'applied', 'interview_scheduled', 'assessment', 'offer'].includes(r.status as string)).length;
  const applied = rows.filter(r => ['applied', 'interview_scheduled', 'assessment', 'offer'].includes(r.status as string)).length;
  const interview = rows.filter(r => ['interview_scheduled', 'assessment', 'offer'].includes(r.status as string)).length;
  const offer = has('offer');

  const funnel = [
    { stage: 'Scraped', count: total },
    { stage: 'Matched', count: matched },
    { stage: 'Applied', count: applied },
    { stage: 'Interview', count: interview },
    { stage: 'Offer', count: offer },
  ];

  const sourceMap = new Map<string, number>();
  for (const r of rows) {
    const k = (r.ats_type as string) ?? 'unknown';
    sourceMap.set(k, (sourceMap.get(k) ?? 0) + 1);
  }
  const sources = [...sourceMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const buckets = [0, 0, 0, 0, 0]; // 0-19, 20-39, 40-59, 60-79, 80-100
  for (const r of rows) {
    const s = r.match_score as number | null;
    if (s == null) continue;
    buckets[Math.min(Math.floor(s / 20), 4)]++;
  }
  const histogram = ['0–19', '20–39', '40–59', '60–79', '80–100'].map((range, i) => ({ range, count: buckets[i] }));

  return NextResponse.json({ funnel, sources, histogram });
}
