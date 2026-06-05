'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Loader2 } from 'lucide-react';

interface Analytics {
  funnel: { stage: string; count: number }[];
  sources: { name: string; value: number }[];
  histogram: { range: string; count: number }[];
}

const SOURCE_COLORS = ['#0a7ae0', '#f59e0b', '#16a34a', '#7c3aed', '#e11d48', '#0891b2'];
const tooltipStyle = {
  background: '#fff', border: '1px solid hsl(220 18% 89%)', borderRadius: 12,
  boxShadow: '0 8px 30px hsl(222 40% 15% / 0.08)', fontSize: 12,
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => { fetch('/api/analytics').then(r => r.json()).then(setData).catch(() => {}); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">Conversion funnel, source mix, and match-score distribution.</p>
      </div>

      {!data ? (
        <div className="card grid place-items-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Crunching numbers…
        </div>
      ) : (
        <>
          {/* Funnel */}
          <div className="card p-5">
            <p className="mb-4 font-display text-sm font-bold text-foreground">Conversion funnel</p>
            <div className="space-y-2.5">
              {data.funnel.map((f, i) => {
                const max = data.funnel[0].count || 1;
                const pct = Math.round((f.count / max) * 100);
                return (
                  <div key={f.stage} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-muted-foreground">{f.stage}</span>
                    <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-muted">
                      <div
                        className="flex h-full items-center justify-end rounded-lg px-2 text-xs font-bold text-primary-foreground transition-all duration-700"
                        style={{ width: `${Math.max(pct, 6)}%`, background: `hsl(212 90% ${44 + i * 7}%)` }}
                      >
                        <span className="nums">{f.count}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Source mix */}
            <div className="card p-5">
              <p className="mb-4 font-display text-sm font-bold text-foreground">Source mix</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={data.sources} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                    {data.sources.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Score histogram */}
            <div className="card p-5">
              <p className="mb-4 font-display text-sm font-bold text-foreground">Match-score distribution</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.histogram}>
                  <CartesianGrid vertical={false} stroke="hsl(220 18% 92%)" />
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(212 92% 96%)' }} />
                  <Bar dataKey="count" fill="#0a7ae0" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
