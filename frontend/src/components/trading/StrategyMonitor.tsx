"use client";
import React, { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Award, AlertCircle, Zap } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Cell, Tooltip, XAxis, YAxis } from 'recharts';
import { apiUrl } from '../../lib/api';

type StrategyStatus = 'LIVE' | 'RUNNING' | 'PAUSED' | 'ERROR';

interface Stats {
  totalTrades: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  sharpe: number;
  riskReward: number;
  avgHoldMins: number;
  profitFactor: number;
  bestTrade: number;
  worstTrade: number;
  totalProfit: number;
  totalLoss: number;
  lastSignal: string;
  lastOrder: string;
  latencyMs: number;
  returns: { label: string; pnl: number }[];
}

interface BollingerState {
  period: number;
  multiplier: number;
  upper: number;
  middle: number;
  lower: number;
  lastPrice: number;
  percentB: number;
  bandwidthPct: number;
  signal: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  symbol: string;
}

const EMPTY_STATS: Stats = {
  totalTrades: 0, winRate: 0, avgProfit: 0, avgLoss: 0,
  sharpe: 0, riskReward: 0, avgHoldMins: 0, profitFactor: 0,
  bestTrade: 0, worstTrade: 0, totalProfit: 0, totalLoss: 0,
  lastSignal: '—', lastOrder: '—', latencyMs: 0, returns: [],
};

const STATUS_CFG: Record<StrategyStatus, { color: string; bg: string; dot: string; glow: string }> = {
  LIVE:    { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  dot: 'bg-green-400',  glow: 'shadow-[0_0_10px_rgba(34,197,94,0.3)]' },
  RUNNING: { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',    dot: 'bg-blue-400',   glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]' },
  PAUSED:  { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30',dot: 'bg-yellow-400', glow: '' },
  ERROR:   { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',      dot: 'bg-red-400',    glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]' },
};

function StatBox({ label, value, sub, color = 'text-neutral-200' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
      <div className="text-[9px] text-neutral-500 tracking-widest mb-0.5">{label}</div>
      <div className={`font-bold text-sm ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-neutral-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function computeBollinger(
  closes: number[], period = 20, multiplier = 2, symbol = ''
): BollingerState | null {
  if (closes.length < period) return null;
  const window = closes.slice(-period);
  const mean = window.reduce((s, v) => s + v, 0) / period;
  const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + multiplier * std;
  const lower = mean - multiplier * std;
  const lastPrice = closes[closes.length - 1];
  const bandRange = Math.max(upper - lower, 1e-9);
  const percentB = ((lastPrice - lower) / bandRange) * 100;
  const bandwidthPct = (bandRange / mean) * 100;
  const signal: BollingerState['signal'] =
    lastPrice >= upper ? 'OVERBOUGHT' : lastPrice <= lower ? 'OVERSOLD' : 'NEUTRAL';
  return { period, multiplier, upper, middle: mean, lower, lastPrice, percentB, bandwidthPct, signal, symbol };
}

/** Compute a simple realised P&L from an order list.
 *  Buy orders are costs, sell orders are proceeds.
 *  This will not be perfectly accurate without position pairing,
 *  but is fully based on real broker data.
 */
function buildStatsFromOrders(orders: any[]): Partial<Stats> {
  const filled = orders.filter(o =>
    (o.status === 'filled' || o.status === 'done_for_day') &&
    o.filled_avg_price != null && o.filled_qty != null
  );
  if (filled.length === 0) return {};

  const pnlByOrder = filled.map((o: any) => {
    const fillPrice = parseFloat(o.filled_avg_price);
    const qty       = parseFloat(o.filled_qty);
    const isSell    = String(o.side).includes('sell');
    return isSell ? fillPrice * qty : -(fillPrice * qty);
  });

  const wins  = pnlByOrder.filter(p => p > 0);
  const loses = pnlByOrder.filter(p => p < 0);

  const totalProfit = wins.reduce((a, p) => a + p, 0);
  const totalLoss   = loses.reduce((a, p) => a + p, 0);
  const avgProfit   = wins.length  > 0 ? totalProfit / wins.length  : 0;
  const avgLoss     = loses.length > 0 ? totalLoss   / loses.length : 0;
  const profitFactor = Math.abs(totalLoss) > 0 ? Math.abs(totalProfit / totalLoss) : 0;
  const best  = Math.max(...pnlByOrder, 0);
  const worst = Math.min(...pnlByOrder, 0);

  const lastOrderTime = filled[0]?.submitted_at || filled[0]?.filled_at;

  const returns = filled.slice(-20).map((o: any, i: number) => ({
    label: `${o.symbol} ${String(o.side).includes('sell') ? 'S' : 'B'}${i + 1}`,
    pnl:   String(o.side).includes('sell')
      ? parseFloat(o.filled_avg_price) * parseFloat(o.filled_qty)
      : -(parseFloat(o.filled_avg_price) * parseFloat(o.filled_qty)),
  }));

  return {
    totalTrades:  filled.length,
    winRate:      filled.length > 0 ? (wins.length / pnlByOrder.length) * 100 : 0,
    avgProfit,
    avgLoss,
    profitFactor,
    totalProfit,
    totalLoss,
    bestTrade:  best,
    worstTrade: worst,
    lastOrder:  lastOrderTime
      ? new Date(lastOrderTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : '—',
    returns,
  };
}

export default function StrategyMonitor({ symbol = 'SPY' }: { symbol?: string }) {
  const [stats,  setStats]  = useState<Stats>(EMPTY_STATS);
  const [status, setStatus] = useState<StrategyStatus>('RUNNING');
  const [bb,     setBb]     = useState<BollingerState | null>(null);
  const scfg = STATUS_CFG[status];

  useEffect(() => {
    const fetch_ = async () => {
      const t0 = Date.now();
      try {
        const [ordRes, barsRes] = await Promise.all([
          fetch(apiUrl('/trading/orders?status=closed')),
          fetch(apiUrl(`/market/bars/${encodeURIComponent(symbol)}?timeframe=1Day&limit=60`)),
        ]);
        const latencyMs = Date.now() - t0;

        if (ordRes.ok) {
          const orders: any[] = await ordRes.json();
          const derived = buildStatsFromOrders(orders);
          setStats(prev => ({ ...prev, ...derived, latencyMs }));
        }

        if (barsRes.ok) {
          const barsPayload = await barsRes.json();
          const closes: number[] = (barsPayload?.bars ?? [])
            .map((b: any) => Number(b.close))
            .filter((v: number) => Number.isFinite(v));
          const nextBb = computeBollinger(closes, 20, 2, symbol);
          if (nextBb) setBb(nextBb);
        }

        setStatus('LIVE');
      } catch {
        setStatus('ERROR');
      }
    };
    fetch_();
    const iv = setInterval(fetch_, 10000);
    return () => clearInterval(iv);
  }, [symbol]);

  const net = stats.totalProfit + stats.totalLoss;
  const bbSignalColor = bb?.signal === 'OVERBOUGHT' ? 'text-red-400'
    : bb?.signal === 'OVERSOLD' ? 'text-green-400'
    : 'text-neutral-300';

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      {/* Header with status */}
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-neutral-400" />
          <h3 className="text-sm font-bold text-white tracking-wider">STRATEGY MONITOR</h3>
          <span className="text-[9px] text-neutral-600">{symbol}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-bold ${scfg.bg} ${scfg.color} ${scfg.glow}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${scfg.dot} animate-pulse`} />
          {status}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 space-y-3">
        {/* Core stats grid */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatBox label="TRADES"       value={String(stats.totalTrades)} />
          <StatBox label="WIN RATE"     value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 50 ? 'text-green-400' : stats.totalTrades === 0 ? 'text-neutral-500' : 'text-red-400'} />
          <StatBox label="AVG PROFIT"   value={stats.avgProfit > 0 ? `+$${stats.avgProfit.toFixed(2)}` : '—'} color="text-green-400" />
          <StatBox label="AVG LOSS"     value={stats.avgLoss  < 0 ? `$${stats.avgLoss.toFixed(2)}`  : '—'} color="text-red-400" />
          <StatBox label="SHARPE"       value={stats.sharpe.toFixed(2)}
            color={stats.sharpe >= 1.5 ? 'text-green-400' : stats.sharpe >= 1 ? 'text-yellow-400' : 'text-neutral-500'} />
          <StatBox label="RISK/REWARD"  value={stats.riskReward > 0 ? `1:${stats.riskReward.toFixed(2)}` : '—'} color="text-purple-400" />
          <StatBox label="PROFIT FACTOR" value={stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : '—'} color="text-blue-400"
            sub={stats.totalTrades > 0 ? `${stats.totalTrades} trades` : undefined} />
          <StatBox label="AVG HOLD"     value={stats.avgHoldMins > 0 ? `${Math.floor(stats.avgHoldMins / 60)}h ${stats.avgHoldMins % 60}m` : '—'} />
        </div>

        {/* Net P&L */}
        <div className={`rounded p-3 border ${net > 0 ? 'bg-green-500/8 border-green-500/20' : net < 0 ? 'bg-red-500/8 border-red-500/20' : 'bg-neutral-800/30 border-neutral-700'}`}>
          <div className="text-[9px] text-neutral-500 mb-1">NET REALIZED P&L</div>
          <div className={`text-xl font-black ${net > 0 ? 'text-green-400' : net < 0 ? 'text-red-400' : 'text-neutral-500'}`}>
            {net > 0 ? '+' : ''}{stats.totalTrades > 0 ? `$${net.toFixed(2)}` : '—'}
          </div>
          {stats.totalTrades > 0 && (
            <div className="flex gap-3 text-[10px] mt-1">
              <span className="text-green-600">Profit: +${stats.totalProfit.toFixed(2)}</span>
              <span className="text-red-600">Loss: ${stats.totalLoss.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Trade histogram */}
        {stats.returns.length > 0 && (
          <div>
            <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">TRADE RETURNS DISTRIBUTION</div>
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={stats.returns} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={false} axisLine={false} tickLine={false} />
                <YAxis tick={false} axisLine={false} tickLine={false} width={0} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}
                  formatter={(v: any) => [`${v >= 0 ? '+' : ''}$${Number(v).toFixed(2)}`, 'P&L']}
                  labelFormatter={(l) => l}
                />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                  {stats.returns.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bollinger strategy block */}
        <div className="rounded p-3 border bg-amber-500/5 border-amber-500/20">
          <div className="text-[9px] text-neutral-500 tracking-widest mb-2">
            BOLLINGER STRATEGY (BB 20,2) — {bb?.symbol ?? symbol}
          </div>
          {bb ? (
            <div className="grid grid-cols-2 gap-1.5">
              <StatBox label="LAST"      value={`$${bb.lastPrice.toFixed(2)}`}       color="text-white" />
              <StatBox label="SIGNAL"    value={bb.signal}                            color={bbSignalColor} />
              <StatBox label="UPPER"     value={`$${bb.upper.toFixed(2)}`}           color="text-amber-300" />
              <StatBox label="LOWER"     value={`$${bb.lower.toFixed(2)}`}           color="text-amber-300" />
              <StatBox label="%B"        value={`${bb.percentB.toFixed(1)}%`}        color="text-blue-400" />
              <StatBox label="BANDWIDTH" value={`${bb.bandwidthPct.toFixed(2)}%`}   color="text-purple-400" />
            </div>
          ) : (
            <div className="text-[10px] text-neutral-500">Loading Bollinger data for {symbol}…</div>
          )}
        </div>

        {/* Best / Worst */}
        {stats.totalTrades > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded p-2">
              <Award className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <div>
                <div className="text-[9px] text-neutral-500">BEST TRADE</div>
                <div className="text-xs font-bold text-green-400">+${stats.bestTrade.toFixed(2)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded p-2">
              <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <div>
                <div className="text-[9px] text-neutral-500">WORST TRADE</div>
                <div className="text-xs font-bold text-red-400">${stats.worstTrade.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Status row */}
        <div className="space-y-1 border-t border-neutral-800 pt-2">
          {[
            ['LAST SIGNAL', stats.lastSignal],
            ['LAST EXEC',   stats.lastOrder],
            ['DATA LATENCY', stats.latencyMs > 0 ? `${stats.latencyMs}ms` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px]">
              <span className="text-neutral-600">{k}</span>
              <span className={`font-mono ${
                k === 'DATA LATENCY'
                  ? (stats.latencyMs > 0 && stats.latencyMs < 200 ? 'text-green-500'
                      : stats.latencyMs >= 200 ? 'text-yellow-500' : 'text-neutral-600')
                  : 'text-neutral-400'
              }`}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
