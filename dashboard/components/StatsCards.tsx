'use client';

import { Layers, Send, CalendarCheck, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface Stats {
  totalScraped: number;
  appliedThisWeek: number;
  activeInterviews: number;
  responseRate: number;
}

const TONES = {
  blue: 'bg-primary/10 text-primary',
  amber: 'bg-accent/15 text-accent',
  green: 'bg-success/10 text-success',
  slate: 'bg-muted text-muted-foreground',
} as const;

function Card({
  label, value, sub, icon: Icon, tone, delay,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; tone: keyof typeof TONES; delay: number;
}) {
  return (
    <div className="card animate-rise p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
        <span className={cn('grid h-9 w-9 place-items-center rounded-xl', TONES[tone])}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
      </div>
      <p className="nums mt-3 font-display text-4xl font-bold leading-none text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card label="Total Scraped" value={stats.totalScraped} sub="all time" icon={Layers} tone="blue" delay={0} />
      <Card label="Applied This Week" value={stats.appliedThisWeek} sub="last 7 days" icon={Send} tone="amber" delay={60} />
      <Card label="Active Interviews" value={stats.activeInterviews} sub="interview scheduled" icon={CalendarCheck} tone="green" delay={120} />
      <Card label="Response Rate" value={`${stats.responseRate.toFixed(1)}%`} sub="interviews + assessments + offers" icon={TrendingUp} tone="slate" delay={180} />
    </div>
  );
}
