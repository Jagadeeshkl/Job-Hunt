'use client';

import { Fragment, useState } from 'react';
import { ExternalLink, ChevronDown } from 'lucide-react';
import { MatchBadge } from './MatchBadge';
import { ApproveButton } from './ApproveButton';
import { cn } from '../lib/utils';

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
                    {app.status === 'matched' && !app.is_manual_required && (
                      <ApproveButton applicationId={app.id} onStatusChange={handleStatusChange} />
                    )}
                    {app.status === 'approved' && app.resume_storage_url && (
                      <div className="flex gap-3 text-xs font-medium">
                        <a href={app.resume_storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Resume</a>
                        {app.cover_letter_storage_url && (
                          <a href={app.cover_letter_storage_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Cover</a>
                        )}
                      </div>
                    )}
                    {app.status === 'applied' && (
                      <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">View JD</a>
                    )}
                    {app.is_manual_required && app.status !== 'applied' && (
                      <span className="pill bg-accent/15 text-accent">Manual</span>
                    )}
                  </td>
                </tr>
                {expanded === app.id && app.match_justification && (
                  <tr className="bg-muted/30">
                    <td colSpan={8} className="whitespace-pre-wrap px-6 py-3 text-xs leading-relaxed text-muted-foreground">
                      {app.match_justification}
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
