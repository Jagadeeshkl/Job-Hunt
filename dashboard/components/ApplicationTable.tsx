'use client';

import { useState } from 'react';
import { MatchBadge } from './MatchBadge';
import { ApproveButton } from './ApproveButton';

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
}

const STATUS_COLORS: Record<string, string> = {
  scraped: 'bg-gray-800 text-gray-300',
  matched: 'bg-blue-900 text-blue-300',
  approved: 'bg-indigo-900 text-indigo-300',
  applied: 'bg-purple-900 text-purple-300',
  interview_scheduled: 'bg-green-900 text-green-300',
  assessment: 'bg-yellow-900 text-yellow-300',
  rejected: 'bg-red-900 text-red-300',
  offer: 'bg-emerald-900 text-emerald-300',
};

function SkillPills({ skills }: { skills: string[] | null }) {
  if (!skills || skills.length === 0) return <span className="text-gray-600 text-xs">—</span>;
  const visible = skills.slice(0, 3);
  const rest = skills.length - 3;
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(s => (
        <span key={s} className="pill bg-gray-800 text-gray-300">{s}</span>
      ))}
      {rest > 0 && <span className="pill bg-gray-700 text-gray-400">+{rest}</span>}
    </div>
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
      <div className="card text-center text-gray-500 py-12">
        No applications found. Run the scraper to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            {['Company', 'Role', 'Score', 'Justification', 'Missing Skills', 'Status', 'Applied', 'Action'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {appList.map(app => (
            <>
              <tr key={app.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                <td className="px-4 py-3 font-medium">
                  <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 transition-colors">
                    {app.company}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{app.role}</td>
                <td className="px-4 py-3"><MatchBadge score={app.match_score} /></td>
                <td className="px-4 py-3">
                  {app.match_justification ? (
                    <button
                      onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {expanded === app.id ? 'Hide' : 'View'}
                    </button>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3"><SkillPills skills={app.missing_skills} /></td>
                <td className="px-4 py-3">
                  <span className={`pill ${STATUS_COLORS[app.status] ?? 'bg-gray-800 text-gray-300'}`}>
                    {app.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {app.applied_at ? new Date(app.applied_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  {app.status === 'matched' && !app.is_manual_required && (
                    <ApproveButton applicationId={app.id} onStatusChange={handleStatusChange} />
                  )}
                  {app.status === 'approved' && app.resume_storage_url && (
                    <div className="flex gap-2 text-xs">
                      <a href={app.resume_storage_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Resume</a>
                      {app.cover_letter_storage_url && (
                        <a href={app.cover_letter_storage_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Cover</a>
                      )}
                    </div>
                  )}
                  {app.status === 'applied' && (
                    <a href={app.jd_url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:text-gray-300">View JD</a>
                  )}
                  {app.is_manual_required && app.status !== 'applied' && (
                    <span className="pill bg-orange-900 text-orange-300">Manual</span>
                  )}
                </td>
              </tr>
              {expanded === app.id && app.match_justification && (
                <tr key={`${app.id}-exp`} className="bg-gray-900">
                  <td colSpan={8} className="px-6 py-3 text-xs text-gray-400 whitespace-pre-wrap">
                    {app.match_justification}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
