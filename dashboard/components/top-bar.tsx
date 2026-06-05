'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeft, Search, Bell, MapPin } from 'lucide-react';
import { ResumeUpload } from './ResumeUpload';

export function TopBar({ onToggle }: { onToggle: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/applications?search=${encodeURIComponent(term)}` : '/applications');
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onToggle}
        aria-label="Toggle sidebar"
        className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PanelLeft className="h-[18px] w-[18px]" />
      </button>

      <form onSubmit={submit} className="relative hidden flex-1 max-w-xl sm:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search company or role…"
          className="h-10 w-full rounded-full border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 lg:flex">
          <span className="pill bg-muted text-muted-foreground"><MapPin className="h-3 w-3" /> Chennai</span>
          <span className="pill bg-muted text-muted-foreground"><MapPin className="h-3 w-3" /> Bangalore</span>
        </div>

        <ResumeUpload />

        <button
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-card" />
        </button>

        <button className="flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 transition-colors hover:bg-muted">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">J</span>
          <span className="hidden text-sm font-medium text-foreground sm:block">Jagadeesh</span>
        </button>
      </div>
    </header>
  );
}
