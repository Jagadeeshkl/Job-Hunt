'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';
import { ToastHost } from './toast';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Persist the collapsed preference across navigations / reloads.
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) setCollapsed(saved === '1');
  }, []);

  function toggle() {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', prev ? '0' : '1');
      return !prev;
    });
  }

  // The login page renders full-screen, without the app chrome.
  if (pathname === '/login') return <>{children}</>;

  return (
    <div className="min-h-screen">
      <AppSidebar collapsed={collapsed} />
      <ToastHost />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-300 ease-out', collapsed ? 'pl-[76px]' : 'pl-64')}>
        <TopBar onToggle={toggle} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
