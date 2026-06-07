'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Filter as FilterIcon } from 'lucide-react';
import { MatchBadge } from '../../components/MatchBadge';

interface FilteredJob {
  id: string;
  company: string;
  role: string;
  jd_url: string;
  match_score: number | null;
  match_justification: string | null;
  score_breakdown: Record<string, { score: number; reason: string }> | null;
  created_at: string;
}

export default function FilteredPage() {
  const [jobs, setJobs] = useState<FilteredJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/applications?status=filtered')
      .then(r => r.json())
      .then(d => {
        const list: FilteredJob[] = d.applications ?? [];
        // Highest score first so near-misses (55-59) surface above gate-rejected (no score).
        list.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        setJobs(list);
      })
      .finally(() => setLoading(false));
  }, []);

  async function restore(id: string) {
    setJobs(prev => prev.filter(j => j.id !== id));
    await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'matched' }),
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Filtered / Low-score</h1>
        <p className="text-sm text-muted-foreground">Jobs the gate skipped or that scored under 60. Nothing is deleted — restore any to Review.</p>
      </div>

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><FilterIcon className="h-7 w-7" /></span>
          <p className="font-display text-lg font-semibold text-foreground">Nothing filtered</p>
          <p className="max-w-sm text-sm text-muted-foreground">Gate-rejected and sub-60 jobs will appear here.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Company', 'Role', 'Score', 'Reason', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <a href={j.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary">
                        {j.company}<ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{j.role}</td>
                    <td className="px-4 py-3">{j.score_breakdown ? <MatchBadge score={j.match_score} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-xs text-muted-foreground" title={j.match_justification ?? ''}>{j.match_justification ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => restore(j.id)} className="pill bg-primary/10 text-primary transition-colors hover:bg-primary/20">Restore to Review</button>
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
