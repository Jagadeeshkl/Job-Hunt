'use client';

import { useEffect, useState, useCallback } from 'react';
import { StatsCards } from '../components/StatsCards';
import { ApplicationTable, type Application } from '../components/ApplicationTable';
// Location filter: Chennai + Bangalore only (set in scraper/index.ts)
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const STATUS_OPTIONS = ['all', 'scraped', 'matched', 'approved', 'applied', 'interview_scheduled', 'assessment', 'rejected', 'offer'];

const PIE_COLORS = ['#6366f1', '#22d3ee', '#a3e635', '#fb923c', '#f43f5e', '#e879f9', '#34d399', '#fbbf24'];

interface Stats {
  totalScraped: number;
  appliedThisWeek: number;
  activeInterviews: number;
  responseRate: number;
  dailyChart: { date: string; count: number }[];
  statusChart: { name: string; value: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
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

      const statsData = await statsRes.json();
      const appsData = await appsRes.json();

      setStats(statsData);
      setApplications(appsData.applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scoreMin, scoreMax, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <StatsCards
          stats={{
            totalScraped: stats.totalScraped,
            appliedThisWeek: stats.appliedThisWeek,
            activeInterviews: stats.activeInterviews,
            responseRate: stats.responseRate,
          }}
        />
      )}

      {/* Filters */}
      <div className="card flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Score</label>
          <input
            type="number" min={0} max={100}
            value={scoreMin}
            onChange={e => setScoreMin(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg w-16 px-2 py-1.5 text-sm text-gray-200 focus:outline-none"
            placeholder="0"
          />
          <span className="text-gray-600">–</span>
          <input
            type="number" min={0} max={100}
            value={scoreMax}
            onChange={e => setScoreMax(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded-lg w-16 px-2 py-1.5 text-sm text-gray-200 focus:outline-none"
            placeholder="100"
          />
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <label className="text-xs text-gray-400">Search</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Company name…"
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
          />
        </div>

        <button
          onClick={fetchData}
          className="ml-auto px-4 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Application Table */}
      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading applications…</div>
      ) : (
        <ApplicationTable
          applications={applications}
          onStatusChange={() => fetchData()}
        />
      )}

      {/* Charts */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <p className="text-sm font-medium text-gray-300 mb-4">Applications per Day (last 14 days)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.dailyChart}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  itemStyle={{ color: '#a5b4fc' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="text-sm font-medium text-gray-300 mb-4">Status Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.statusChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {stats.statusChart.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  itemStyle={{ color: '#e5e7eb' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
