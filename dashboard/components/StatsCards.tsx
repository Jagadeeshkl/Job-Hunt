'use client';

interface Stats {
  totalScraped: number;
  appliedThisWeek: number;
  activeInterviews: number;
  responseRate: number;
}

interface StatsCardsProps {
  stats: Stats;
}

function Card({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card label="Total Scraped" value={stats.totalScraped} sub="all time" />
      <Card label="Applied This Week" value={stats.appliedThisWeek} />
      <Card
        label="Active Interviews"
        value={stats.activeInterviews}
        sub="interview_scheduled"
      />
      <Card
        label="Response Rate"
        value={`${stats.responseRate.toFixed(1)}%`}
        sub="interviews + assessments + offers"
      />
    </div>
  );
}
