'use client';

import { cn } from '../lib/utils';

export function MatchBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="pill bg-muted text-muted-foreground">—</span>;
  }

  const tone =
    score >= 80 ? 'bg-success/10 text-success'
    : score >= 60 ? 'bg-accent/15 text-accent'
    : 'bg-danger/10 text-danger';

  const dot = score >= 80 ? 'bg-success' : score >= 60 ? 'bg-accent' : 'bg-danger';

  return (
    <span className={cn('pill nums font-semibold', tone)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      {score}
    </span>
  );
}
