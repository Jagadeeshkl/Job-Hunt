'use client';

interface MatchBadgeProps {
  score: number | null;
}

export function MatchBadge({ score }: MatchBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="pill bg-gray-800 text-gray-400">—</span>;
  }

  const color =
    score >= 80
      ? 'bg-green-900 text-green-300 border border-green-700'
      : score >= 60
      ? 'bg-yellow-900 text-yellow-300 border border-yellow-700'
      : 'bg-red-900 text-red-300 border border-red-700';

  return <span className={`pill ${color}`}>{score}%</span>;
}
