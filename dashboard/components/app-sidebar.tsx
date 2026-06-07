'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Inbox, Briefcase, ExternalLink,
  CalendarCheck, BarChart3, Settings, Sparkles, Star, Filter,
} from 'lucide-react';
import { cn } from '../lib/utils';

type BadgeKey = 'review' | 'manual' | 'interviews' | 'saved' | 'filtered';

const NAV: { href: string; label: string; icon: React.ElementType; badge?: BadgeKey }[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/review', label: 'Review', icon: Inbox, badge: 'review' },
  { href: '/saved', label: 'Saved', icon: Star, badge: 'saved' },
  { href: '/applications', label: 'Applications', icon: Briefcase },
  { href: '/manual', label: 'Manual Apply', icon: ExternalLink, badge: 'manual' },
  { href: '/interviews', label: 'Interviews', icon: CalendarCheck, badge: 'interviews' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/filtered', label: 'Excluded', icon: Filter, badge: 'filtered' },
];

export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const [counts, setCounts] = useState<Record<BadgeKey, number>>({ review: 0, manual: 0, interviews: 0, saved: 0, filtered: 0 });

  useEffect(() => {
    fetch('/api/counts')
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setCounts(d))
      .catch(() => {});
  }, [pathname]);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300 ease-out',
        collapsed ? 'w-[76px]' : 'w-64'
      )}
    >
      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-5 h-16 border-b border-sidebar-border', collapsed && 'justify-center px-0')}>
        <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <Sparkles className="h-5 w-5" strokeWidth={2.25} />
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-sidebar" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold text-foreground">Job Agent</p>
            <p className="text-[11px] text-sidebar-muted">AI application pipeline</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {!collapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted">Workspace</p>
        )}
        <ul className="space-y-1">
          {NAV.map(item => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-active-bg text-sidebar-active-fg'
                      : 'text-sidebar-foreground hover:bg-muted',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-sidebar-muted group-hover:text-sidebar-foreground')} strokeWidth={2} />
                  {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                  {!collapsed && count > 0 && (
                    <span className={cn('pill nums', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{count}</span>
                  )}
                  {collapsed && count > 0 && (
                    <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full bg-accent" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/settings"
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-muted',
            pathname.startsWith('/settings') && 'bg-sidebar-active-bg text-sidebar-active-fg',
            collapsed && 'justify-center px-0'
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0 text-sidebar-muted" strokeWidth={2} />
          {!collapsed && <span>Settings</span>}
        </Link>
      </div>
    </aside>
  );
}
