"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { X, TrendingUp, TrendingDown, Clock, Target, ShieldAlert } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface Position {
  symbol: string;
  qty: number;
  side: 'long' | 'short';
  avg_entry_price: number;
  current_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_plpc: number;
  cost_basis: number;
  // augmented
  stop_loss?: number;
  target_price?: number;
  opened_at?: string;
  status?: string;
}

// Augment positions with stop/target/time (Alpaca doesn't store these on positions)
function augment(p: any): Position {
  const entry = parseFloat(p.avg_entry_price) || 0;
  const cur   = parseFloat(p.current_price)   || entry;
  const qty   = parseFloat(p.qty) || 0;
  const side  = qty >= 0 ? 'long' : 'short';
  const pl    = parseFloat(p.unrealized_pl)   || (cur - entry) * Math.abs(qty);
  const plpc  = parseFloat(p.unrealized_plpc) || (entry ? (cur - entry) / entry * 100 : 0);
  return {
    symbol:           p.symbol,
    qty:              Math.abs(qty),
    side,
    avg_entry_price:  entry,
    current_price:    cur,
    market_value:     parseFloat(p.market_value) || cur * Math.abs(qty),
    unrealized_pl:    pl,
    unrealized_plpc:  plpc, // backend already returns as percentage (no extra ×100 needed)
    cost_basis:       parseFloat(p.cost_basis) || entry * Math.abs(qty),
    stop_loss:        side === 'long' ? parseFloat((entry * 0.97).toFixed(2)) : parseFloat((entry * 1.03).toFixed(2)),
    target_price:     side === 'long' ? parseFloat((entry * 1.06).toFixed(2)) : parseFloat((entry * 0.94).toFixed(2)),
    opened_at:        p.opened_at ?? null,  // Alpaca positions don't carry open time
    status:           'OPEN',
  };
}

// Mock fallback when backend is down (function avoids module-level Date.now() SSR mismatch)
function getMockPositions(): Position[] {
  return [
    { symbol: 'GLD',  qty: 15, side: 'long',  avg_entry_price: 218.10, current_price: 221.40, market_value: 3321, unrealized_pl: 49.50,  unrealized_plpc: 1.51,  cost_basis: 3271.5, stop_loss: 211.56, target_price: 231.19, opened_at: new Date(Date.now()-14400000).toISOString(), status:'OPEN' },
    { symbol: 'USO',  qty: 20, side: 'long',  avg_entry_price:  74.50, current_price:  76.20, market_value: 1524, unrealized_pl: 34.00,  unrealized_plpc: 2.28,  cost_basis: 1490,   stop_loss:  72.27, target_price:  78.97, opened_at: new Date(Date.now()-7200000).toISOString(),  status:'OPEN' },
    { symbol: 'NVDA', qty:  2, side: 'long',  avg_entry_price: 874.10, current_price: 871.30, market_value: 1742.6, unrealized_pl: -5.60,  unrealized_plpc: -0.32, cost_basis: 1748.2, stop_loss: 847.88, target_price: 927.55, opened_at: new Date(Date.now()-1800000).toISOString(),  status:'OPEN' },
    { symbol: 'UNG',  qty: 10, side: 'long',  avg_entry_price:  11.20, current_price:  10.85, market_value: 108.5, unrealized_pl: -3.50,  unrealized_plpc: -3.13, cost_basis: 112,    stop_loss:  10.86, target_price:  11.87, opened_at: new Date(Date.now()-28800000).toISOString(), status:'OPEN' },
  ];
}

function fmt(n: number, decs = 2) { return n.toFixed(decs); }
function fmtTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ── Detail side panel ──────────────────────────────────────
function TradeDetailPanel({ pos, onClose }: { pos: Position; onClose: () => void }) {
  const isUp = pos.unrealized_pl >= 0;
  const riskReward = pos.stop_loss && pos.target_price
    ? Math.abs((pos.target_price - pos.avg_entry_price) / (pos.avg_entry_price - pos.stop_loss))
    : null;
  const distToTarget = pos.target_price ? ((pos.target_price - pos.current_price) / pos.current_price * 100) : null;
  const distToStop   = pos.stop_loss   ? ((pos.current_price - pos.stop_loss) / pos.current_price * 100) : null;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[280px] bg-neutral-900/98 border-l border-neutral-700 flex flex-col z-20 backdrop-blur-xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 flex justify-between items-start shrink-0">
        <div>
          <div className="flex items-center gap-2">
            {pos.side === 'long'
              ? <TrendingUp className="w-4 h-4 text-green-400" />
              : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-white font-black text-lg font-mono">{pos.symbol}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              pos.side === 'long' ? 'text-green-400 bg-green-500/10 border-green-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'
            }`}>{pos.side.toUpperCase()}</span>
          </div>
          <div className="text-neutral-500 text-[10px] mt-0.5 font-mono">Opened {fmtTime(pos.opened_at)}</div>
        </div>
        <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 font-mono text-xs">
        {/* P&L Big Display */}
        <div className={`p-3 rounded border ${isUp ? 'bg-green-500/8 border-green-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
          <div className="text-[9px] text-neutral-500 mb-1">UNREALIZED P&L</div>
          <div className={`text-2xl font-black ${isUp ? 'text-green-400' : 'text-red-400'}`}>
            {isUp ? '+' : ''}${fmt(pos.unrealized_pl)}
          </div>
          <div className={`text-sm font-bold ${isUp ? 'text-green-500' : 'text-red-500'}`}>
            {isUp ? '+' : ''}{fmt(pos.unrealized_plpc)}%
          </div>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            ['ENTRY',   `$${fmt(pos.avg_entry_price)}`, 'text-neutral-300'],
            ['CURRENT', `$${fmt(pos.current_price)}`,   isUp ? 'text-green-400' : 'text-red-400'],
            ['SIZE',    `${pos.qty} shares`,             'text-neutral-300'],
            ['VALUE',   `$${fmt(pos.market_value)}`,     'text-neutral-300'],
          ].map(([label, val, cls]) => (
            <div key={label} className="bg-neutral-950 rounded p-2 border border-neutral-800">
              <div className="text-[9px] text-neutral-500 mb-0.5">{label}</div>
              <div className={`font-bold ${cls}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Risk levels */}
        <div>
          <div className="text-[9px] text-neutral-500 tracking-widest mb-2">RISK LEVELS</div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Target className="w-3 h-3 text-green-400" />
                <span className="text-neutral-400">Target</span>
              </div>
              <div className="text-right">
                <span className="text-green-400 font-bold">${fmt(pos.target_price ?? 0)}</span>
                {distToTarget !== null && (
                  <span className="text-neutral-600 ml-1.5 text-[10px]">+{fmt(distToTarget)}%</span>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {pos.stop_loss && pos.target_price && (() => {
              const range  = pos.target_price - pos.stop_loss;
              const filled = Math.min(1, Math.max(0, (pos.current_price - pos.stop_loss) / range));
              return (
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full" style={{ width: `${filled * 100}%` }} />
                </div>
              );
            })()}

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-red-400" />
                <span className="text-neutral-400">Stop</span>
              </div>
              <div className="text-right">
                <span className="text-red-400 font-bold">${fmt(pos.stop_loss ?? 0)}</span>
                {distToStop !== null && (
                  <span className="text-neutral-600 ml-1.5 text-[10px]">-{fmt(Math.abs(distToStop))}%</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* R/R */}
        {riskReward !== null && (
          <div className="bg-neutral-950 rounded p-2 border border-neutral-800">
            <div className="text-[9px] text-neutral-500 mb-1">RISK / REWARD</div>
            <div className="text-sm font-bold text-purple-400">1 : {fmt(riskReward)}</div>
          </div>
        )}

        {/* Cost basis */}
        <div className="flex justify-between text-[10px] text-neutral-500 border-t border-neutral-800 pt-2">
          <span>Cost basis</span>
          <span>${fmt(pos.cost_basis)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function OpenTrades({
  onSelectSymbol,
  activeSymbol,
  livePrice,
}: {
  onSelectSymbol?: (s: string) => void;
  activeSymbol?: string;
  livePrice?: number | null;
}) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [selected, setSelected]   = useState<Position | null>(null);
  const [loading,  setLoading]    = useState(false);

  const effectivePositions = useMemo(() => {
    return positions.map((p) => {
      if (!activeSymbol || !livePrice || p.symbol.toUpperCase() !== activeSymbol.toUpperCase()) return p;

      // Ignore stale or mismatched feed values that are too far from the position quote.
      if (p.current_price > 0) {
        const deltaRatio = Math.abs(livePrice - p.current_price) / p.current_price;
        if (deltaRatio > 0.35) return p;
      }

      const multiplier = p.side === 'long' ? 1 : -1;
      const unrealized = (livePrice - p.avg_entry_price) * multiplier * p.qty;
      const unrealizedPct = p.avg_entry_price > 0
        ? ((livePrice - p.avg_entry_price) * multiplier / p.avg_entry_price) * 100
        : 0;
      return {
        ...p,
        current_price: livePrice,
        market_value: livePrice * p.qty,
        unrealized_pl: unrealized,
        unrealized_plpc: unrealizedPct,
      };
    });
  }, [positions, activeSymbol, livePrice]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(apiUrl('/portfolio/positions'));
        if (res.ok) {
          const raw = await res.json();
          if (Array.isArray(raw)) setPositions(raw.map(augment));
        }
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 2000);
    return () => clearInterval(iv);
  }, []);

  // Keep selected in sync as prices update
  useEffect(() => {
    if (selected) {
      const updated = effectivePositions.find(p => p.symbol === selected.symbol);
      if (
        updated && (
          updated.current_price !== selected.current_price ||
          updated.unrealized_pl !== selected.unrealized_pl ||
          updated.unrealized_plpc !== selected.unrealized_plpc ||
          updated.market_value !== selected.market_value
        )
      ) {
        setSelected(updated);
      }
    }
  }, [effectivePositions, selected]);

  const totalUnrealized = effectivePositions.reduce((a, p) => a + p.unrealized_pl, 0);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden relative">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wider">OPEN TRADES</h3>
          <div className="text-[10px] text-neutral-500 mt-0.5">{effectivePositions.length} active positions</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-neutral-500">UNREALIZED P&L</div>
          <div className={`text-sm font-bold ${totalUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalUnrealized >= 0 ? '+' : ''}${fmt(totalUnrealized)}
          </div>
        </div>
      </div>

      {/* Column headers */}
      <div className="px-3 py-1.5 border-b border-neutral-800 grid text-[9px] text-neutral-500 font-bold tracking-widest shrink-0"
        style={{ gridTemplateColumns: '80px 50px 80px 80px 60px 90px 80px 70px 60px' }}>
        <span>SYMBOL</span><span>DIR</span><span>ENTRY</span><span>CURRENT</span>
        <span>SIZE</span><span>UNREAL P&L</span><span>STOP</span><span>TARGET</span><span>OPENED</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {effectivePositions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-xs">No open positions</div>
        ) : (
          effectivePositions.map((p) => {
            const isUp  = p.unrealized_pl >= 0;
            const isSel = selected?.symbol === p.symbol;
            return (
              <div
                key={p.symbol}
                onClick={() => { setSelected(isSel ? null : p); onSelectSymbol?.(p.symbol); }}
                className={`grid items-center px-3 py-2 border-b border-neutral-800/40 cursor-pointer transition-colors text-xs
                  ${isSel ? 'bg-neutral-800/70' : 'hover:bg-neutral-800/30'}`}
                style={{ gridTemplateColumns: '80px 50px 80px 80px 60px 90px 80px 70px 60px' }}
              >
                <span className="font-black text-white">{p.symbol}</span>
                <span className={`font-bold uppercase text-[10px] ${p.side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                  {p.side}
                </span>
                <span className="text-neutral-300 font-mono">${fmt(p.avg_entry_price)}</span>
                <span className={`font-mono font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>${fmt(p.current_price)}</span>
                <span className="text-neutral-400">{p.qty}</span>
                <div>
                  <div className={`font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '+' : ''}${fmt(p.unrealized_pl)}
                  </div>
                  <div className={`text-[10px] ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                    {isUp ? '+' : ''}{fmt(p.unrealized_plpc)}%
                  </div>
                </div>
                <span className="text-red-400/80 font-mono text-[11px]">${fmt(p.stop_loss ?? 0)}</span>
                <span className="text-green-400/80 font-mono text-[11px]">${fmt(p.target_price ?? 0)}</span>
                <span className="text-neutral-600 text-[10px]">{fmtTime(p.opened_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Detail side panel */}
      {selected && <TradeDetailPanel pos={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
