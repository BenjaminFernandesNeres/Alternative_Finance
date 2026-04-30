"use client";
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const VIX_THRESHOLDS = [
  { label: 'CALM', min: 0, max: 15, color: '#10b981' },
  { label: 'ELEVATED', min: 15, max: 25, color: '#f59e0b' },
  { label: 'STRESSED', min: 25, max: 35, color: '#ef4444' },
  { label: 'CRISIS', min: 35, max: 100, color: '#7c3aed' },
];

function genVixHistory(days = 60) {
  const pts = [];
  let vix = 18;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    vix = Math.max(10, Math.min(55, vix + (Math.random() - 0.48) * 1.5));
    pts.push({ date: d.toISOString().split('T')[0], vix: parseFloat(vix.toFixed(2)) });
  }
  return pts;
}

export default function VolatilityTracker() {
  const [data, setData] = useState<ReturnType<typeof genVixHistory>>([]);

  useEffect(() => { setData(genVixHistory()); }, []);

  const current = data[data.length - 1]?.vix ?? 18;
  const prev = data[data.length - 2]?.vix ?? 18;
  const change = current - prev;
  const regime = VIX_THRESHOLDS.find(t => current >= t.min && current < t.max) ?? VIX_THRESHOLDS[1];

  const FEAR_GREED = Math.max(0, Math.min(100, Math.round(100 - (current - 10) * 2.5)));
  const fearLabel = FEAR_GREED > 75 ? 'EXTREME GREED' : FEAR_GREED > 55 ? 'GREED' : FEAR_GREED > 45 ? 'NEUTRAL' : FEAR_GREED > 25 ? 'FEAR' : 'EXTREME FEAR';
  const fearColor = FEAR_GREED > 55 ? '#10b981' : FEAR_GREED > 45 ? '#f59e0b' : '#ef4444';

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">VOLATILITY / VIX</h3>
        <span className="text-[10px] px-2 py-0.5 rounded font-bold border" style={{ color: regime.color, borderColor: regime.color + '40', background: regime.color + '15' }}>
          {regime.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b border-neutral-800 shrink-0">
        <div>
          <div className="text-[9px] text-neutral-500">VIX</div>
          <div className="text-xl font-black" style={{ color: regime.color }}>{current.toFixed(2)}</div>
          <div className={`text-[10px] font-bold ${change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-neutral-500">FEAR & GREED</div>
          <div className="text-xl font-black" style={{ color: fearColor }}>{FEAR_GREED}</div>
          <div className="text-[9px]" style={{ color: fearColor }}>{fearLabel}</div>
        </div>
        <div>
          <div className="text-[9px] text-neutral-500">14D AVG</div>
          <div className="text-xl font-black text-neutral-300">{data.length >= 14 ? (data.slice(-14).reduce((a, d) => a + d.vix, 0) / 14).toFixed(1) : '—'}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="vixGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={regime.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={regime.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} interval={9} />
            <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} width={28} />
            <Tooltip contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }} formatter={(v: any) => [v, 'VIX']} />
            <Area type="monotone" dataKey="vix" stroke={regime.color} strokeWidth={2} fill="url(#vixGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
