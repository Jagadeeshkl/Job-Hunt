'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Mail, Lock, Loader2, ArrowRight, Briefcase, Bot, BarChart3 } from 'lucide-react';

// Job-hunt themed hero image (career / interview). Falls back to the blue
// gradient overlay if it can't load.
const HERO_IMAGE =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Login failed');
      const from = params.get('from');
      router.replace(from && from.startsWith('/') ? from : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT — branded job-hunt hero */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(15,42,120,0.92), rgba(31,84,214,0.86)), url('${HERO_IMAGE}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold">Job Agent</p>
            <p className="text-xs text-white/70">AI application pipeline</p>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            Your job hunt, on autopilot.
          </h1>
          <p className="mt-4 text-white/80">
            Scrape, match, tailor, and apply — every day, automatically. Sign in to review
            your matches and approve tailored resumes in one click.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3"><Bot className="h-4 w-4 text-white/80" /> Gemini-matched AI/ML roles, daily</li>
            <li className="flex items-center gap-3"><Briefcase className="h-4 w-4 text-white/80" /> One-click tailored resume & cover letter</li>
            <li className="flex items-center gap-3"><BarChart3 className="h-4 w-4 text-white/80" /> Track every application to offer</li>
          </ul>
        </div>

        <p className="text-xs text-white/60">Built for Jagadeesh · Chennai · Bangalore</p>
      </div>

      {/* RIGHT — login form */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          {/* compact brand for small screens */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="font-display text-lg font-bold text-foreground">Job Agent</p>
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your job-hunt dashboard.</p>

          {error && (
            <div className="mt-5 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Private dashboard · authorized access only
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
