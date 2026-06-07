// Shared rubric metadata for rendering the score breakdown.
export interface Dimension { score: number; reason: string }
export type ScoreBreakdown = Record<string, Dimension>;

export const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'stack_fit', label: 'Stack fit' },
  { key: 'seniority', label: 'Seniority' },
  { key: 'location', label: 'Location' },
  { key: 'compensation', label: 'Compensation' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'mission', label: 'Mission' },
];

/** Tailwind bg class for a 0-100 score. */
export function scoreColor(score: number): string {
  if (score >= 75) return 'bg-success';
  if (score >= 50) return 'bg-primary';
  return 'bg-danger';
}
