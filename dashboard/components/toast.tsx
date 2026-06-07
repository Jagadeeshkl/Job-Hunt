'use client';

import { useEffect, useState } from 'react';
import { Star, ExternalLink, X } from 'lucide-react';
import { SAVED_TOAST, type SavedToastDetail } from '../lib/events';

interface Toast extends SavedToastDetail {
  id: number;
}

/** Global toast host — mounted once in the Shell. Listens for SAVED_TOAST events. */
export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    function onSaved(e: Event) {
      const detail = (e as CustomEvent<SavedToastDetail>).detail;
      const id = Date.now() + Math.random();
      setToasts(prev => [...prev, { id, ...detail }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }
    window.addEventListener(SAVED_TOAST, onSaved);
    return () => window.removeEventListener(SAVED_TOAST, onSaved);
  }, []);

  function dismiss(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-50 flex w-80 flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className="animate-rise rounded-xl border border-border bg-card p-3 shadow-lift">
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
              <Star className="h-4 w-4 fill-accent" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Saved · {t.company}</p>
              <p className="text-[11px] text-muted-foreground">{t.date}</p>
              <a
                href={t.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                View job <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <button onClick={() => dismiss(t.id)} className="text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
