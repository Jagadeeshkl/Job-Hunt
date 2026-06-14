'use client';

import { cn } from '../lib/utils';

// Shared pill-style action button used across the Applications table and the
// Excluded page so the Remove / Mark applied / Revert / Restore buttons stay
// visually identical and live in one place.
const TONES = {
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
  success: 'bg-success/10 text-success hover:bg-success/20',
  muted: 'bg-muted text-muted-foreground hover:bg-muted/70',
  primary: 'bg-primary/10 text-primary hover:bg-primary/20',
} as const;

type Tone = keyof typeof TONES;

export function PillButton({
  tone, onClick, children, className,
}: {
  tone: Tone;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button onClick={onClick} className={cn('pill transition-colors', TONES[tone], className)}>
      {children}
    </button>
  );
}
