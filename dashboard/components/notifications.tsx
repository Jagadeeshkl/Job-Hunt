'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Star, ExternalLink, Inbox } from 'lucide-react';
import { NOTIFY_REFRESH } from '../lib/events';

interface Notif {
  id: string;
  company: string;
  role: string;
  jd_url: string;
  updated_at: string | null;
  created_at: string;
}

const SEEN_KEY = 'seen-notifications';

function getSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}
function setSeen(ids: string[]) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
}

/** Notifications bell — lists saved (starred) jobs, newest first, with an
 *  unread badge for jobs saved since the dropdown was last opened. */
export function Notifications() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/applications?starred=true');
      const d = await res.json();
      const list: Notif[] = (d.applications ?? []).map((a: Record<string, unknown>) => ({
        id: String(a.id),
        company: String(a.company ?? ''),
        role: String(a.role ?? ''),
        jd_url: String(a.jd_url ?? ''),
        updated_at: (a.updated_at as string) ?? null,
        created_at: String(a.created_at ?? ''),
      }));
      list.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at).getTime() -
          new Date(a.updated_at || a.created_at).getTime()
      );
      setItems(list);
      const seen = getSeen();
      setUnread(list.filter(n => !seen.includes(n.id)).length);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onRefresh() {
      load();
    }
    window.addEventListener(NOTIFY_REFRESH, onRefresh);
    return () => window.removeEventListener(NOTIFY_REFRESH, onRefresh);
  }, [load]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      if (next) {
        setSeen(items.map(i => i.id));
        setUnread(0);
      }
      return next;
    });
  }

  function fmt(s: string | null) {
    if (!s) return '';
    return new Date(s).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white ring-2 ring-card">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lift">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">Saved jobs</p>
            <Link href="/saved" onClick={() => setOpen(false)} className="text-[11px] font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="grid place-items-center gap-1 px-4 py-10 text-center text-muted-foreground">
                <Inbox className="h-6 w-6" />
                <p className="text-xs">No saved jobs yet. Press <b>F</b> in Review to save one.</p>
              </div>
            ) : (
              items.map(n => (
                <div key={n.id} className="flex items-start gap-2.5 border-b border-border/60 px-4 py-3 last:border-0 hover:bg-muted/40">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                    <Star className="h-4 w-4 fill-accent" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{n.company}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{n.role}</p>
                    <p className="text-[11px] text-muted-foreground">{fmt(n.updated_at || n.created_at)}</p>
                  </div>
                  <a href={n.jd_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-primary hover:text-primary/80" aria-label="Open job">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
