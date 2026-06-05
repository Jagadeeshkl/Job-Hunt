'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, SlidersHorizontal, RefreshCw, Activity } from 'lucide-react';
import { StatsCards } from '../components/StatsCards';
import { ApplicationTable, type Application } from '../components/ApplicationTable';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from 'recharts';

const STATUS_OPTIONS = ['all', 'scraped', 'matched', 'approved', 'applied', 'interview_scheduled', 'assessment', 'rejected', 'offer'];
const PIE_COLORS = ['#0a7ae0', '#f59e0b', '#16a34a', '#7c3aed', '#e11d48', '#0891b2', '#65a30d', '#db2777'];

interface Stats {
  totalScraped: number;
  appliedThisWeek: number;
  activeInterviews: number;
  responseRate: number;
  dailyChart: { date: string; count: number }[];
  statusChart: { name: string; value: number }[];
}

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid hsl(220 18% 89%)',
  borderRadius: 12,
  boxShadow: '0 8px 30px hsl(222 40% 15% / 0.08)',
  fontSize: 12,
};

function timeAgo(iso?: string) {
  if (!iso) return '';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function ActivityFeed({ apps }: { apps: Application[] }) {
  const recent = [...apps]
    .sort((a, b) => String((b as any).created_at).localeCompare(String((a as any).created_at)))
    .slice(0, 7);

  return (
    <div className="card flex h-full flex-col p-5">
      <div className="mb-4 flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-bold text-foreground">Latest Activity</h3>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent activity.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-4">
          {recent.map(a => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
              <p className="text-xs font-medium text-foreground">
                <span className="font-semibold">{a.company}</span> — {a.role}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <span className="capitalize">{a.status.replace(/_/g, ' ')}</span>
                {(a as any).created_at && ` · ${timeAgo((a as any).created_at)}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (scoreMin > 0) params.set('minScore', String(scoreMin));
      if (scoreMax < 100) params.set('maxScore', String(scoreMax));
      if (search) params.set('search', search);

      const [statsRes, appsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch(`/api/applications?${params.toString()}`),
      ]);
      setStats(await statsRes.json());
      setApplications((await appsRes.json()).applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scoreMin, scoreMax, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your autonomous job pipeline at a glance.</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Insights */}
      {stats && <StatsCards stats={stats} />}

      {/* Working surface: filters + table (2 cols) | activity (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Filters */}
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm capitalize text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <input type="number" min={0} max={100} value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))}
                className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span className="text-muted-foreground">–</span>
              <input type="number" min={0} max={100} value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))}
                className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
              <span className="text-xs text-muted-foreground">score</span>
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Company name…"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="card grid place-items-center py-16 text-sm text-muted-foreground">Loading applications…</div>
          ) : (
            <ApplicationTable applications={applications} onStatusChange={() => fetchData()} />
          )}
        </div>

        {/* Activity */}
        <ActivityFeed apps={applications} />
      </div>

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="card p-5">
            <p className="mb-4 font-display text-sm font-bold text-foreground">Applications per day · last 14 days</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.dailyChart}>
                <CartesianGrid vertical={false} stroke="hsl(220 18% 92%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={d => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(212 92% 96%)' }} />
                <Bar dataKey="count" fill="#0a7ae0" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <p className="mb-4 font-display text-sm font-bold text-foreground">Status distribution</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                  {stats.statusChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
