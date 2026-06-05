'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { ApplicationTable, type Application } from '../../components/ApplicationTable';

const STATUS_OPTIONS = ['all', 'scraped', 'matched', 'approved', 'applied', 'interview_scheduled', 'assessment', 'rejected', 'offer'];

function ApplicationsInner() {
  const initialSearch = useSearchParams().get('search') ?? '';

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [scoreMin, setScoreMin] = useState(0);
  const [scoreMax, setScoreMax] = useState(100);
  const [search, setSearch] = useState(initialSearch);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (scoreMin > 0) params.set('minScore', String(scoreMin));
      if (scoreMax < 100) params.set('maxScore', String(scoreMax));
      if (search) params.set('search', search);
      const res = await fetch(`/api/applications?${params.toString()}`);
      setApplications((await res.json()).applications ?? []);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, scoreMin, scoreMax, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading…' : `${applications.length} application${applications.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm capitalize text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} max={100} value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))}
            className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <span className="text-muted-foreground">–</span>
          <input type="number" min={0} max={100} value={scoreMax} onChange={e => setScoreMax(Number(e.target.value))}
            className="h-9 w-16 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
          <span className="text-xs text-muted-foreground">score</span>
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Company name…"
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>

      {loading ? (
        <div className="card grid place-items-center py-16 text-sm text-muted-foreground">Loading applications…</div>
      ) : (
        <ApplicationTable applications={applications} />
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="card grid place-items-center py-16 text-sm text-muted-foreground">Loading…</div>}>
      <ApplicationsInner />
    </Suspense>
  );
}
