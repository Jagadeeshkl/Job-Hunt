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
      const approveRes = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: applicationId }),
      });

      if (!approveRes.ok) throw new Error('Approval request failed');

      // Poll until status changes to 'approved'
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        if (attempts > 60) {
          clearInterval(poll);
          setError('Timed out waiting for generation');
          setLoading(false);
          return;
        }

        const res = await fetch(`/api/applications?id=${applicationId}`);
        const data = await res.json();
        const app = data?.application;

        if (app?.status === 'approved') {
          clearInterval(poll);
          setLoading(false);
          onStatusChange(applicationId, 'approved', app.resume_storage_url, app.cover_letter_storage_url);
        }
      }, 5000);
    } catch (err) {
      setError(String(err));
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
