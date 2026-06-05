'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, ExternalLink, CalendarCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MatchBadge } from '../../components/MatchBadge';

interface Job {
  id: string;
  company: string;
  role: string;
  match_score: number | null;
  status: string;
  jd_url: string;
}

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: 'interview_scheduled', label: 'Scheduled', accent: 'bg-primary' },
  { key: 'assessment', label: 'Assessment', accent: 'bg-accent' },
  { key: 'offer', label: 'Offer', accent: 'bg-success' },
  { key: 'rejected', label: 'Rejected', accent: 'bg-danger' },
];
const STAGES = ['applied', 'interview_scheduled', 'assessment', 'offer', 'rejected'];

export default function InterviewsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/applications')
      .then(r => r.json())
      .then(d => setJobs((d.applications ?? []).filter((j: Job) => COLUMNS.some(c => c.key === j.status))))
      .finally(() => setLoading(false));
  }, []);

  const move = useCallback(async (id: string, status: string) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, status } : j)).filter(j => COLUMNS.some(c => c.key === j.status)));
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Interviews</h1>
        <p className="text-sm text-muted-foreground">Track the later pipeline. Change an application&apos;s stage from its card.</p>
      </div>

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CalendarCheck className="h-7 w-7" /></span>
          <p className="font-display text-lg font-semibold text-foreground">No interviews yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Once applications move to interview stages, they&apos;ll appear on this board.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map(col => {
            const items = jobs.filter(j => j.status === col.key);
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', col.accent)} />
                    <span className="text-sm font-semibold text-foreground">{col.label}</span>
                  </div>
                  <span className="pill bg-muted text-muted-foreground nums">{items.length}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">Empty</div>
                  )}
                  {items.map(j => (
                    <div key={j.id} className="card animate-rise space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <a href={j.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                            {j.company} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </a>
                          <p className="truncate text-xs text-muted-foreground">{j.role}</p>
                        </div>
                        <MatchBadge score={j.match_score} />
                      </div>
                      <select
                        value={j.status}
                        onChange={e => move(j.id, e.target.value)}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs capitalize text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      >
                        {STAGES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
