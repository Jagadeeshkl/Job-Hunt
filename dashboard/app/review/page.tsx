'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, SkipForward, Star, Check, ExternalLink, MapPin,
  Wallet, Sparkles, Inbox, Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { MatchBadge } from '../../components/MatchBadge';

interface ReviewJob {
  id: string;
  company: string;
  role: string;
  location: string | null;
  salary_range: string | null;
  match_score: number | null;
  match_justification: string | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  jd_text: string | null;
  jd_url: string;
  ats_type: string;
  is_manual_required: boolean;
  starred?: boolean;
}

export default function ReviewPage() {
  const [cards, setCards] = useState<ReviewJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/applications?status=matched')
      .then(r => r.json())
      .then(d => {
        const list: ReviewJob[] = d.applications ?? [];
        setCards(list);
        setTotal(list.length);
      })
      .finally(() => setLoading(false));
  }, []);

  const current = cards[0];

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed');
  }, []);

  const advance = useCallback(() => setCards(prev => prev.slice(1)), []);

  const onReject = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true); setError(null);
    try { await patch(current.id, { status: 'dismissed' }); advance(); }
    catch (e) { setError(`Reject failed — ${String(e instanceof Error ? e.message : e)} (did the DB migration run?)`); }
    finally { setBusy(false); }
  }, [current, busy, patch, advance]);

  const onSkip = useCallback(() => {
    if (!current || busy) return;
    setCards(prev => (prev.length > 1 ? [...prev.slice(1), prev[0]] : prev));
  }, [current, busy]);

  const onSave = useCallback(async () => {
    if (!current || busy) return;
    setBusy(true); setError(null);
    const next = !current.starred;
    setCards(prev => prev.map((c, i) => (i === 0 ? { ...c, starred: next } : c)));
    try { await patch(current.id, { starred: next }); }
    catch (e) {
      setCards(prev => prev.map((c, i) => (i === 0 ? { ...c, starred: !next } : c)));
      setError(`Save failed — ${String(e instanceof Error ? e.message : e)} (did the DB migration run?)`);
    } finally { setBusy(false); }
  }, [current, busy, patch]);

  const onApprove = useCallback(async () => {
    if (!current || busy) return;
    if (current.is_manual_required) {
      window.open(current.jd_url, '_blank', 'noopener');
      advance();
      return;
    }
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: current.id }),
      });
      if (!res.ok) throw new Error('Approve request failed');
      advance();
    } catch (e) { setError(String(e instanceof Error ? e.message : e)); }
    finally { setBusy(false); }
  }, [current, busy, patch, advance]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'r' || k === 'arrowleft') { e.preventDefault(); onReject(); }
      else if (k === 's' || k === 'arrowright') { e.preventDefault(); onSkip(); }
      else if (k === 'f') { e.preventDefault(); onSave(); }
      else if (k === 'a' || k === 'enter') { e.preventDefault(); onApprove(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onReject, onSkip, onSave, onApprove]);

  const decided = total - cards.length;
  const progress = total ? Math.round((decided / total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Review</h1>
          <p className="text-sm text-muted-foreground">Clear the matched backlog, one job at a time.</p>
        </div>
        {!loading && total > 0 && (
          <span className="pill bg-muted text-muted-foreground nums">{cards.length} in queue</span>
        )}
      </div>

      {/* progress */}
      {!loading && total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-xs text-danger">{error}</div>
      )}

      {loading ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading queue…
        </div>
      ) : !current ? (
        <div className="card grid place-items-center gap-3 py-24 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success">
            <Inbox className="h-7 w-7" />
          </span>
          <p className="font-display text-lg font-semibold text-foreground">Inbox zero 🎉</p>
          <p className="max-w-sm text-sm text-muted-foreground">No matched jobs left to review. New matches will appear here after the next daily run.</p>
        </div>
      ) : (
        <>
          {/* CARD — keyed on id so it re-animates on each advance */}
          <article key={current.id} className="card animate-rise overflow-hidden">
            <div className="border-b border-border p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-base font-bold uppercase text-primary">
                    {current.company.slice(0, 2)}
                  </span>
                  <div>
                    <a href={current.jd_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-display text-lg font-bold text-foreground hover:text-primary">
                      {current.company}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                    <p className="text-sm text-muted-foreground">{current.role}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <MatchBadge score={current.match_score} />
                  {current.starred && <Star className="h-4 w-4 fill-accent text-accent" />}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {current.location && <span className="pill bg-muted text-muted-foreground"><MapPin className="h-3 w-3" />{current.location}</span>}
                {current.salary_range && <span className="pill bg-muted text-muted-foreground"><Wallet className="h-3 w-3" />{current.salary_range}</span>}
                <span className="pill bg-muted text-muted-foreground capitalize">{current.ats_type}</span>
                {current.is_manual_required && <span className="pill bg-accent/15 text-accent">Manual apply</span>}
              </div>
            </div>

            <div className="space-y-4 p-6">
              {/* Skills */}
              {(current.matched_skills?.length || current.missing_skills?.length) ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matched</p>
                    <div className="flex flex-wrap gap-1">
                      {(current.matched_skills ?? []).slice(0, 8).map(s => <span key={s} className="pill bg-success/10 text-success">{s}</span>)}
                      {!current.matched_skills?.length && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Missing</p>
                    <div className="flex flex-wrap gap-1">
                      {(current.missing_skills ?? []).slice(0, 8).map(s => <span key={s} className="pill bg-accent/15 text-accent">{s}</span>)}
                      {!current.missing_skills?.length && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Why */}
              {current.match_justification && (
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" /> Why it matched
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{current.match_justification}</p>
                </div>
              )}

              {/* JD excerpt */}
              {current.jd_text && (
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Job description</p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed text-muted-foreground">
                    {current.jd_text}
                  </div>
                </div>
              )}
            </div>
          </article>

          {/* ACTIONS */}
          <div className="sticky bottom-4 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card/90 p-2 shadow-lift backdrop-blur sm:gap-3">
            <ActionButton onClick={onReject} disabled={busy} tone="danger" icon={X} label="Reject" hint="R" />
            <ActionButton onClick={onSkip} disabled={busy} tone="muted" icon={SkipForward} label="Skip" hint="S" />
            <ActionButton onClick={onSave} disabled={busy} tone="accent" icon={Star} label={current.starred ? 'Saved' : 'Save'} hint="F" active={current.starred} />
            <ActionButton onClick={onApprove} disabled={busy} tone="primary" icon={current.is_manual_required ? ExternalLink : Check}
              label={current.is_manual_required ? 'Open & apply' : 'Approve'} hint="A" primary />
          </div>

          <p className="text-center text-[11px] text-muted-foreground">
            Shortcuts: <kbd className="rounded bg-muted px-1.5 py-0.5 font-sans">R</kbd> reject ·
            <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 font-sans">S</kbd> skip ·
            <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 font-sans">F</kbd> save ·
            <kbd className="ml-1 rounded bg-muted px-1.5 py-0.5 font-sans">A</kbd> approve
          </p>
        </>
      )}
    </div>
  );
}

function ActionButton({
  onClick, disabled, icon: Icon, label, hint, tone, primary, active,
}: {
  onClick: () => void; disabled?: boolean; icon: React.ElementType; label: string; hint: string;
  tone: 'danger' | 'muted' | 'accent' | 'primary'; primary?: boolean; active?: boolean;
}) {
  const tones = {
    danger: 'hover:bg-danger/10 hover:text-danger text-foreground',
    muted: 'hover:bg-muted text-foreground',
    accent: cn('hover:bg-accent/15 hover:text-accent text-foreground', active && 'bg-accent/15 text-accent'),
    primary: '',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50',
        primary ? 'bg-primary text-primary-foreground shadow-soft hover:bg-primary/90' : 'border border-border bg-card',
        !primary && tones[tone]
      )}
    >
      <Icon className={cn('h-4 w-4', active && tone === 'accent' && 'fill-accent')} />
      {label}
      <kbd className={cn('ml-1 hidden rounded px-1.5 py-0.5 text-[10px] sm:inline', primary ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>{hint}</kbd>
    </button>
  );
}
