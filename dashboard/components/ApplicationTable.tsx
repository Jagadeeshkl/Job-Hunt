'use client';

import { Fragment, useEffect, useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { MatchBadge } from './MatchBadge';
import { ApproveButton } from './ApproveButton';
import { cn, parseJustification } from '../lib/utils';

export interface Application {
  id: string;
  company: string;
  role: string;
  match_score: number | null;
  match_justification: string | null;
  missing_skills: string[] | null;
  status: string;
  applied_at: string | null;
  is_manual_required: boolean;
  resume_storage_url: string | null;
  cover_letter_storage_url: string | null;
  jd_url: string;
  starred?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scraped: 'bg-muted text-muted-foreground',
  matched: 'bg-primary/10 text-primary',
  approved: 'bg-primary/15 text-primary',
  applied: 'bg-accent/15 text-accent',
  interview_scheduled: 'bg-success/10 text-success',
  assessment: 'bg-success/15 text-success',
  rejected: 'bg-danger/10 text-danger',
  dismissed: 'bg-muted text-muted-foreground',
  offer: 'bg-success/20 text-success',
};

function SkillPills({ skills }: { skills: string[] | null }) {
  if (!skills || skills.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const visible = skills.slice(0, 3);
  const rest = skills.length - 3;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(s => (
        <span key={s} className="pill bg-muted text-muted-foreground">{s}</span>
      ))}
      {rest > 0 && <span className="pill bg-muted text-muted-foreground">+{rest}</span>}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold uppercase text-primary">
      {name.slice(0, 2)}
    </span>
  );
}

interface Props {
  applications: Application[];
  onStatusChange?: (id: string, status: string, resumeUrl?: string, coverUrl?: string) => void;
}

export function ApplicationTable({ applications, onStatusChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [appList, setAppList] = useState(applications);

  // Keep the table in sync when the parent refetches / changes filters.
  useEffect(() => { setAppList(applications); }, [applications]);

  function handleStatusChange(id: string, status: string, resumeUrl?: string, coverUrl?: string) {
    setAppList(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, status, resume_storage_url: resumeUrl ?? a.resume_storage_url, cover_letter_storage_url: coverUrl ?? a.cover_letter_storage_url }
          : a
      )
    );
    onStatusChange?.(id, status, resumeUrl, coverUrl);
  }

  // "Mark applied → Dashboard": you applied manually. Record it and drop the row
  // from this table (applied jobs live on the Dashboard, not Applications).
  async function markApplied(id: string) {
    const applied_at = new Date().toISOString();
    setAppList(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'applied', applied_at }),
      });
      onStatusChange?.(id, 'applied');
    } catch {
      /* optimistic — a refresh will reconcile */
    }
  }

  // "Revert" (Dashboard): undo an applied job → back to the Applications page.
  // Returns to 'approved' if docs were generated, else 'matched'.
  async function revertApplied(id: string) {
    const app = appList.find(a => a.id === id);
    const target = app?.resume_storage_url ? 'approved' : 'matched';
    setAppList(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target, applied_at: null }),
      });
      onStatusChange?.(id, target);
    } catch {
      /* optimistic — a refresh will reconcile */
    }
  }

  if (appList.length === 0) {
    return (
      <div className="card grid place-items-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No applications found</p>
        <p className="text-xs text-muted-foreground">Adjust the filters, or wait for the next daily run.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {['Company', 'Role', 'Score', 'Why', 'Missing Skills', 'Status', 'Applied', 'Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {appList.map(app => (
              <Fragment key={app.id}>
                <tr className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={app.company} />
                      <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-foreground transition-colors hover:text-primary">
                        {app.company}
                        <ExternalLink className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                      </a>
                    </div>
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{app.role}</td>
                  <td className="px-4 py-3"><MatchBadge score={app.match_score} /></td>
                  <td className="px-4 py-3">
                    {app.match_justification ? (
                      <button
                        onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {expanded === app.id ? 'Hide' : 'View'}
                        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded === app.id && 'rotate-180')} />
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3"><SkillPills skills={app.missing_skills} /></td>
                  <td className="px-4 py-3">
                    <span className={cn('pill capitalize', STATUS_COLORS[app.status] ?? 'bg-muted text-muted-foreground')}>
                      {app.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {/* matched (auto ATS) → generate resume + cover */}
                    {app.status === 'matched' && !app.is_manual_required && (
                      <ApproveButton applicationId={app.id} onStatusChange={handleStatusChange} />
                    )}

                    {/* matched (manual) → apply externally, then mark applied */}
                    {app.status === 'matched' && app.is_manual_required && (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                        <span className="pill bg-accent/15 text-accent">Manual</span>
                        <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Apply <ExternalLink className="h-3 w-3" /></a>
                        <button onClick={() => markApplied(app.id)} className="pill bg-success/10 text-success transition-colors hover:bg-success/20">Mark applied</button>
                      </div>
                    )}

                    {/* approved (docs ready) → links + apply + mark applied */}
                    {app.status === 'approved' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                        {app.resume_storage_url && <a href={app.resume_storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resume</a>}
                        {app.cover_letter_storage_url && <a href={app.cover_letter_storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cover</a>}
                        <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">Apply <ExternalLink className="h-3 w-3" /></a>
                        <button onClick={() => markApplied(app.id)} className="pill bg-success/10 text-success transition-colors hover:bg-success/20">Mark applied</button>
                      </div>
                    )}

                    {/* applied → view JD + revert back to Applications */}
                    {app.status === 'applied' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                        <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">View JD <ExternalLink className="h-3 w-3" /></a>
                        <button onClick={() => revertApplied(app.id)} className="pill bg-muted text-muted-foreground transition-colors hover:bg-muted/70">Revert</button>
                      </div>
                    )}

                    {/* downstream stages → view JD */}
                    {['interview_scheduled', 'assessment', 'offer'].includes(app.status) && (
                      <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">View JD <ExternalLink className="h-3 w-3" /></a>
                    )}
                  </td>
                </tr>
                {expanded === app.id && app.match_justification && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="px-6 py-3">
                      <ul className="space-y-1.5">
                        {parseJustification(app.match_justification).map((point, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
