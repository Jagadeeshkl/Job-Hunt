'use client';

import { useState } from 'react';

interface ApproveButtonProps {
  applicationId: string;
  onStatusChange: (id: string, status: string, resumeUrl?: string, coverLetterUrl?: string) => void;
}

export function ApproveButton({ applicationId, onStatusChange }: ApproveButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);

    try {
      // The route tailors, renders both PDFs (server-side Chromium), uploads them,
      // and returns the URLs — no polling needed.
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || 'Approval request failed');
      }

      setLoading(false);
      onStatusChange(applicationId, 'approved', data.resume_storage_url, data.cover_letter_storage_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-accent">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Generating…
      </div>
    );
  }

  if (error) {
    return <span className="text-xs text-danger">{error}</span>;
  }

  return (
    <button
      onClick={handleApprove}
      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
    >
      Approve &amp; Generate
    </button>
  );
}
