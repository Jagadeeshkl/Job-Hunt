'use client';

import { useEffect, useState } from 'react';
import { Star, ExternalLink, Loader2 } from 'lucide-react';
import { MatchBadge } from '../../components/MatchBadge';
import { emitNotifyRefresh } from '../../lib/events';

interface SavedJob {
  id: string;
  company: string;
  role: string;
  jd_url: string;
  match_score: number | null;
  status: string;
  updated_at: string | null;
  created_at: string;
}

export default function SavedPage() {
  const [jobs, setJobs] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/applications?starred=true')
      .then(r => r.json())
      .then(d => {
        const list: SavedJob[] = d.applications ?? [];
        list.sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at).getTime() -
            new Date(a.updated_at || a.created_at).getTime()
        );
        setJobs(list);
      })
      .finally(() => setLoading(false));
  }, []);

  async function unsave(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id));
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ starred: false }),
    });
    emitNotifyRefresh();
  }

  function fmt(s: string | null) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Saved</h1>
        <p className="text-sm text-muted-foreground">Jobs you starred in Review, kept here for later.</p>
      </div>

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Star className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-semibold text-foreground">No saved jobs</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Press <b>F</b> (or the Save button) on a job in Review to keep it here.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Company', 'Role', 'Score', 'Saved', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <a href={j.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary">
                        {j.company}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{j.role}</td>
                    <td className="px-4 py-3"><MatchBadge score={j.match_score} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground nums">{fmt(j.updated_at || j.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="pill bg-muted text-muted-foreground capitalize">{j.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => unsave(j.id)} className="pill bg-accent/15 text-accent transition-colors hover:bg-accent/25">
                        Unsave
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
