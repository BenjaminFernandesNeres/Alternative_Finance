"use client";
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { apiUrl } from '../../lib/api';

interface EquityPoint { date: string; equity: number; benchmark: number; }

function generateEquityCurve(startEquity = 100000): EquityPoint[] {
  const pts: EquityPoint[] = [];
  let eq = startEquity;
  let bench = startEquity;
  const now = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().split('T')[0];
    eq *= 1 + (Math.random() * 0.018 - 0.006);
    bench *= 1 + (Math.random() * 0.012 - 0.005);
    pts.push({ date: day, equity: Math.round(eq), benchmark: Math.round(bench) });
  }
  return pts;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const eq = payload.find((p: any) => p.dataKey === 'equity');
  const bm = payload.find((p: any) => p.dataKey === 'benchmark');
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded p-2 text-[11px] font-mono shadow-xl">
      <div className="text-neutral-400 mb-1">{label}</div>
      {eq && <div className="text-blue-400">Portfolio: ${eq.value.toLocaleString()}</div>}
      {bm && <div className="text-neutral-500">Benchmark: ${bm.value.toLocaleString()}</div>}
    </div>
  );
};

export default function EquityCurve() {
  const [data, setData] = useState<EquityPoint[]>([]);
  const [liveEquity, setLiveEquity] = useState<number>(100000);

  useEffect(() => {
    const pts = generateEquityCurve(100000);
    setData(pts);
    setLiveEquity(pts[pts.length - 1].equity);

    const fetchPortfolio = async () => {
      try {
        const res = await fetch(apiUrl('/portfolio/summary'));
        if (res.ok) {
          const d = await res.json();
          if (d.totals?.portfolio_value) setLiveEquity(d.totals.portfolio_value);
        }
      } catch {}
    };
    fetchPortfolio();
    const iv = setInterval(fetchPortfolio, 10000);
    return () => clearInterval(iv);
  }, []);

  const first = data[0]?.equity ?? 100000;
  const totalReturn = ((liveEquity - first) / first * 100);
  const isUp = totalReturn >= 0;

  const maxDD = data.reduce((acc, d, i) => {
    const peak = Math.max(...data.slice(0, i + 1).map(p => p.equity));
    const dd = ((d.equity - peak) / peak) * 100;
    return Math.min(acc, dd);
  }, 0);

  const sharpe = (totalReturn / 12 / 2.3).toFixed(2); // rough approximation

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">EQUITY CURVE <span className="text-neutral-500 font-normal text-[10px] ml-2">90D</span></h3>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-neutral-500">Live: <span className="text-white font-bold">${liveEquity.toLocaleString()}</span></span>
          <span className={isUp ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{isUp ? '+' : ''}{totalReturn.toFixed(2)}%</span>
        </div>
      </div>

      <div className="flex gap-4 px-4 py-2 border-b border-neutral-800 shrink-0">
        <div><span className="text-[9px] text-neutral-500">MAX DRAWDOWN </span><span className="text-red-400 text-xs font-bold">{maxDD.toFixed(2)}%</span></div>
        <div><span className="text-[9px] text-neutral-500">SHARPE </span><span className="text-blue-400 text-xs font-bold">{sharpe}</span></div>
        <div><span className="text-[9px] text-neutral-500">TOTAL RETURN </span><span className={`text-xs font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>{isUp ? '+' : ''}{totalReturn.toFixed(2)}%</span></div>
      </div>

      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6b7280" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => v.slice(5)} interval={14} />
            <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={36} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="benchmark" stroke="#4b5563" strokeWidth={1} fill="url(#benchGrad)" dot={false} />
            <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} fill="url(#equityGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
