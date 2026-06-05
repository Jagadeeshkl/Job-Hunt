'use client';

import { useEffect, useState } from 'react';
import { Check, Info } from 'lucide-react';

const LOCATIONS = ['Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Remote'];

export default function SettingsPage() {
  const [locations, setLocations] = useState<string[]>(['Chennai', 'Bengaluru']);
  const [threshold, setThreshold] = useState(60);
  const [dailyCap, setDailyCap] = useState(15);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('job-agent-prefs');
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (p.locations) setLocations(p.locations);
        if (p.threshold) setThreshold(p.threshold);
        if (p.dailyCap) setDailyCap(p.dailyCap);
      } catch {}
    }
  }, []);

  function toggle(loc: string) {
    setLocations(prev => (prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]));
  }

  function save() {
    localStorage.setItem('job-agent-prefs', JSON.stringify({ locations, threshold, dailyCap }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Dashboard preferences.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>These are local display preferences. The live agent config (scrape cadence, real caps) lives in the n8n workflows and <code className="rounded bg-primary/10 px-1">.env.local</code>.</p>
      </div>

      <div className="card space-y-6 p-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">Target locations</p>
          <div className="flex flex-wrap gap-2">
            {LOCATIONS.map(loc => {
              const on = locations.includes(loc);
              return (
                <button key={loc} onClick={() => toggle(loc)}
                  className={`pill border transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted'}`}>
                  {on && <Check className="h-3 w-3" />} {loc}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 flex items-center justify-between text-sm font-semibold text-foreground">
            Match-score threshold <span className="nums text-primary">{threshold}</span>
          </label>
          <input type="range" min={0} max={100} value={threshold} onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-[hsl(var(--primary))]" />
          <p className="mt-1 text-xs text-muted-foreground">Jobs scoring ≥ {threshold} are treated as strong matches.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Daily auto-apply cap</label>
          <input type="number" min={0} max={50} value={dailyCap} onChange={e => setDailyCap(Number(e.target.value))}
            className="h-9 w-24 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button onClick={save}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90">
            <Check className="h-4 w-4" /> Save preferences
          </button>
          {saved && <span className="text-xs font-medium text-success">Saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
