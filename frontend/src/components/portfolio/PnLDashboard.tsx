"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface PnLPoint { time: string; total: number; daily: number; unrealized: number; equity: number; drawdown: number; }

function genHistory(n = 90) {
  const pts: PnLPoint[] = [];
  let equity = 100000, peak = 100000, daily = 0;
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ret  = (Math.random() - 0.47) * 0.012;
    daily      = equity * ret;
    equity     = Math.max(equity + daily, 50000);
    peak       = Math.max(peak, equity);
    const dd   = ((equity - peak) / peak) * 100;
    pts.push({
      time:       d.toISOString().split('T')[0],
      equity:     parseFloat(equity.toFixed(2)),
      total:      parseFloat((equity - 100000).toFixed(2)),
      daily:      parseFloat(daily.toFixed(2)),
      unrealized: parseFloat(((Math.random() - 0.45) * 1200).toFixed(2)),
      drawdown:   parseFloat(dd.toFixed(2)),
    });
  }
  return pts;
}

function StatCard({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: React.ElementType }) {
  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 flex items-center gap-3">
      <div className={`p-2 rounded ${color}/10 shrink-0`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] text-neutral-500 tracking-widest">{label}</div>
        <div className={`font-black text-lg leading-tight ${color}`}>{value}</div>
        {sub && <div className="text-[10px] text-neutral-600">{sub}</div>}
      </div>
    </div>
  );
}

const CHART_TOOLTIP_STYLE = { background: '#171717', border: '1px solid #404040', borderRadius: 6, fontFamily: 'monospace', fontSize: 10 };

export default function PnLDashboard() {
  const [history, setHistory] = useState<PnLPoint[]>([]);
  const [liveData,    setLiveData]    = useState<any>(null);
  const [activeChart, setActiveChart] = useState<'equity' | 'pnl' | 'drawdown'>('equity');

  useEffect(() => {
    setHistory(genHistory());
    const fetch_ = async () => {
      try {
        const res = await fetch(apiUrl('/portfolio/summary'));
        if (res.ok) setLiveData(await res.json());
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 5000);
    return () => clearInterval(iv);
  }, []);

  const totals = liveData?.totals;
  const last = history[history.length - 1];
  const totalPnl     = (totals?.total_unrealized_pl + (totals?.realized_pnl ?? 0)) || (last?.total ?? 0);
  const dailyPnl     = totals?.daily_pnl     ?? last?.daily ?? 0;
  const unrealized   = totals?.total_unrealized_pl  ?? last?.unrealized ?? 0;
  const realized     = totals?.realized_pnl  ?? history.reduce((a, p) => a + (p.daily > 0 ? p.daily : 0), 0) * 0.4;

  const currentEquity = totals?.portfolio_value ?? last?.equity ?? 100000;
  const maxDD = history.length > 0 ? Math.min(...history.map(p => p.drawdown)) : 0;

  const stats = [
    { label: 'TOTAL P&L',     value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: totalPnl >= 0 ? 'text-green-400' : 'text-red-400', icon: DollarSign },
    { label: 'DAILY P&L',     value: `${dailyPnl >= 0 ? '+' : ''}$${Math.abs(dailyPnl).toFixed(2)}`,     color: dailyPnl >= 0 ? 'text-green-400' : 'text-red-400',   icon: TrendingUp },
    { label: 'UNREALIZED',    value: `${unrealized >= 0 ? '+' : ''}$${Math.abs(unrealized).toFixed(2)}`, color: unrealized >= 0 ? 'text-blue-400' : 'text-orange-400', icon: BarChart2 },
    { label: 'REALIZED',      value: `+$${Math.abs(realized).toFixed(2)}`,  color: 'text-purple-400',    icon: TrendingDown },
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">P&L DASHBOARD</h3>
        <div className="text-right">
          <div className="text-[9px] text-neutral-500">PORTFOLIO VALUE</div>
          <div className="text-sm font-bold text-white">${currentEquity.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 gap-2 p-3 shrink-0">
        {stats.map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} icon={s.icon} />
        ))}
      </div>

      {/* Chart selector */}
      <div className="flex gap-1 px-3 shrink-0 mb-2">
        {(['equity', 'pnl', 'drawdown'] as const).map(c => (
          <button
            key={c}
            onClick={() => setActiveChart(c)}
            className={`px-3 py-1 rounded text-[10px] font-bold border transition-colors ${
              activeChart === c
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'text-neutral-500 border-neutral-800 hover:border-neutral-600 hover:text-neutral-300'
            }`}
          >
            {c === 'equity' ? 'EQUITY CURVE' : c === 'pnl' ? 'DAILY P&L' : 'DRAWDOWN'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeChart === 'equity' ? (
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)} interval={14} />
              <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={38} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Equity']} />
              <Area type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} fill="url(#eqGrad)" dot={false} />
            </AreaChart>
          ) : activeChart === 'pnl' ? (
            <BarChart data={history.slice(-30)} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)} interval={4} />
              <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${v.toFixed(0)}`} width={44} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: any) => [`${v >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`, 'Daily P&L']} />
              <ReferenceLine y={0} stroke="#374151" />
              <Bar dataKey="daily" radius={[2, 2, 0, 0]}>
                {history.slice(-30).map((e, i) => (
                  <Cell key={i} fill={e.daily >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => v.slice(5)} interval={14} />
              <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => `${v.toFixed(1)}%`} width={38} />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'Drawdown']} />
              <ReferenceLine y={0} stroke="#374151" />
              <Area type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={1.5} fill="url(#ddGrad)" dot={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Max drawdown footer */}
      <div className="px-3 py-2 border-t border-neutral-800 shrink-0 flex justify-between text-[10px] text-neutral-500">
        <span>Max Drawdown: <span className="text-red-400 font-bold">{maxDD.toFixed(2)}%</span></span>
        <span>History: 90 days</span>
      </div>
    </div>
  );
}
