'use client';

import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Check, MapPin, Wallet, Loader2, ExternalLink as LinkIcon } from 'lucide-react';
import { MatchBadge } from '../../components/MatchBadge';

interface ManualJob {
  id: string;
  company: string;
  role: string;
  location: string | null;
  salary_range: string | null;
  match_score: number | null;
  jd_url: string;
  status: string;
}

const ACTIONABLE = ['scraped', 'matched', 'approved'];

export default function ManualPage() {
  const [jobs, setJobs] = useState<ManualJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/applications?manual=true')
      .then(r => r.json())
      .then(d => setJobs((d.applications ?? []).filter((j: ManualJob) => ACTIONABLE.includes(j.status))))
      .finally(() => setLoading(false));
  }, []);

  const markApplied = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/applications/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'applied', applied_at: new Date().toISOString() }),
      });
      if (res.ok) setJobs(prev => prev.filter(j => j.id !== id));
    } finally { setBusyId(null); }
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Manual Apply</h1>
        <p className="text-sm text-muted-foreground">
          Indeed &amp; custom jobs that can&apos;t be auto-applied — open the link, apply, then mark done.
        </p>
      </div>

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><Check className="h-7 w-7" /></span>
          <p className="font-display text-lg font-semibold text-foreground">All caught up</p>
          <p className="max-w-sm text-sm text-muted-foreground">No manual-apply jobs pending. Indeed jobs land here after the Mon/Thu run.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {jobs.map((j, i) => (
            <div key={j.id} className="card animate-rise flex flex-wrap items-center gap-4 p-4" style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-sm font-bold uppercase text-primary">
                {j.company.slice(0, 2)}
              </span>
              <div className="min-w-[180px] flex-1">
                <p className="font-semibold text-foreground">{j.company}</p>
                <p className="truncate text-sm text-muted-foreground">{j.role}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {j.location && <span className="pill bg-muted text-muted-foreground"><MapPin className="h-3 w-3" />{j.location}</span>}
                  {j.salary_range && <span className="pill bg-muted text-muted-foreground"><Wallet className="h-3 w-3" />{j.salary_range}</span>}
                </div>
              </div>
              <MatchBadge score={j.match_score} />
              <div className="flex items-center gap-2">
                <a href={j.jd_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted">
                  <LinkIcon className="h-3.5 w-3.5" /> Open
                </a>
                <button onClick={() => markApplied(j.id)} disabled={busyId === j.id}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-50">
                  {busyId === j.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Mark applied
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
