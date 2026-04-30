"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { Bot, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle, AlertCircle, Zap, Activity, RefreshCw } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface AutoTrade {
  id: string;
  symbol: string;
  direction: 'BULLISH' | 'BEARISH';
  status: 'WATCHING' | 'TRIGGERED' | 'ACTIVE' | 'CLOSING' | 'FILLED' | 'CANCELLED' | 'ERROR';
  entry_trigger_price: number;
  target_price: number;
  current_price: number | null;
  stop_loss: number;
  qty: number;
  time_horizon_minutes: number;
  entry_price?: number | null;
  exit_price?: number | null;
  exit_order_id?: string | null;
  pnl?: number | null;
  conviction_score: number;
  triggered_at?: string | null;
  filled_at?: string | null;
  close_reason?: string | null;
  error_msg?: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<AutoTrade['status'], {
  color: string; bg: string; icon: React.ElementType; label: string;
}> = {
  WATCHING:  { color: 'text-yellow-400',  bg: 'bg-yellow-500/10 border-yellow-500/20',  icon: Clock,         label: 'WATCHING'  },
  TRIGGERED: { color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',      icon: Zap,           label: 'TRIGGERED' },
  ACTIVE:    { color: 'text-cyan-400',    bg: 'bg-cyan-500/10 border-cyan-500/20',      icon: Activity,      label: 'ACTIVE'    },
  CLOSING:   { color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20',  icon: RefreshCw,     label: 'CLOSING'   },
  FILLED:    { color: 'text-green-400',   bg: 'bg-green-500/10 border-green-500/20',    icon: CheckCircle,   label: 'FILLED'    },
  CANCELLED: { color: 'text-neutral-500', bg: 'bg-neutral-800/50 border-neutral-700/50',icon: XCircle,       label: 'CANCELLED' },
  ERROR:     { color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',        icon: AlertCircle,   label: 'ERROR'     },
};

function fmt2(n?: number | null) {
  return n != null ? n.toFixed(2) : '—';
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

export default function AutoTradeMonitor() {
  const [trades,      setTrades]      = useState<AutoTrade[]>([]);
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [loading,     setLoading]     = useState(false);

  const fetchWatchlist = useCallback(async () => {
    try {
      const [wlRes, stRes] = await Promise.all([
        fetch(apiUrl('/autotrade/watchlist')),
        fetch(apiUrl('/autotrade/status')),
      ]);
      if (wlRes.ok)  setTrades(await wlRes.json());
      if (stRes.ok) {
        const st = await stRes.json();
        setAutoEnabled(st.enabled ?? true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchWatchlist();
    const iv = setInterval(fetchWatchlist, 3000);
    return () => clearInterval(iv);
  }, [fetchWatchlist]);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/autotrade/toggle'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAutoEnabled(data.enabled);
      }
    } catch {}
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    try {
      await fetch(apiUrl(`/autotrade/watchlist/${id}`), { method: 'DELETE' });
      fetchWatchlist();
    } catch {}
  };

  const totalPnl     = trades.reduce((a, t) => a + (t.pnl ?? 0), 0);
  const activeTrades = trades.filter(t => ['WATCHING','TRIGGERED','ACTIVE','CLOSING'].includes(t.status)).length;
  const filledTrades = trades.filter(t => t.status === 'FILLED').length;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white tracking-wider">AUTO TRADE MONITOR</h3>
          </div>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold border transition-all ${
              autoEnabled
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
                : 'bg-neutral-800 text-neutral-500 border-neutral-700'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoEnabled ? 'bg-purple-400 animate-pulse' : 'bg-neutral-600'}`} />
            {autoEnabled ? 'AUTO-TRADE ON' : 'AUTO-TRADE OFF'}
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-neutral-800/50 rounded p-2">
            <div className="text-neutral-500 text-[9px] mb-0.5">TOTAL P&L</div>
            <div className={`font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
          <div className="bg-neutral-800/50 rounded p-2">
            <div className="text-neutral-500 text-[9px] mb-0.5">ACTIVE</div>
            <div className="font-bold text-blue-400">{activeTrades}</div>
          </div>
          <div className="bg-neutral-800/50 rounded p-2">
            <div className="text-neutral-500 text-[9px] mb-0.5">FILLED</div>
            <div className="font-bold text-green-400">{filledTrades}</div>
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-xs">
            No auto-trade entries
          </div>
        ) : (
          trades.map(t => {
            const cfg    = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.ERROR;
            const Icon   = cfg.icon;
            const isSel  = selected === t.id;
            const isGone = t.status === 'CANCELLED' || t.status === 'FILLED';

            // Trigger proximity progress (how close current price is to entry trigger)
            let progress = 0;
            if (t.current_price != null && t.entry_trigger_price > 0) {
              const pct = t.direction === 'BULLISH'
                ? 100 - ((t.current_price - t.entry_trigger_price) / (t.entry_trigger_price * 0.05)) * 100
                : 100 - ((t.entry_trigger_price - t.current_price) / (t.entry_trigger_price * 0.05)) * 100;
              progress = Math.min(100, Math.max(0, pct));
            }

            return (
              <div
                key={t.id}
                onClick={() => setSelected(s => s === t.id ? null : t.id)}
                className={`border-b border-neutral-800/50 cursor-pointer transition-colors ${
                  isSel ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/20'
                } ${isGone ? 'opacity-50' : ''}`}
              >
                <div className="px-3 py-2">
                  {/* Title row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {t.direction === 'BULLISH'
                        ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                        : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                      <span className="text-white font-bold text-sm">{t.symbol}</span>
                      <span className="text-neutral-500 text-[10px]">×{t.qty}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-2.5 h-2.5" />
                        {cfg.label}
                      </span>
                      {!isGone && t.status !== 'ERROR' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleCancel(t.id); }}
                          className="text-neutral-600 hover:text-red-400 transition-colors"
                          title="Cancel"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Price grid */}
                  <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
                    <div>
                      <span className="text-neutral-500">ENTRY </span>
                      <span className="text-blue-400 font-bold">${fmt2(t.entry_trigger_price)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">CURRENT </span>
                      <span className="text-neutral-200 font-bold">${fmt2(t.current_price)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">STOP </span>
                      <span className="text-red-400 font-bold">${fmt2(t.stop_loss)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                    <div>
                      <span className="text-neutral-500">TARGET </span>
                      <span className="text-green-400 font-bold">${fmt2(t.target_price)}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500">HORIZON </span>
                      <span className="text-amber-300 font-bold">{t.time_horizon_minutes}m</span>
                    </div>
                  </div>

                  {/* Progress bars */}
                  {!isGone && t.status !== 'ERROR' && (
                    <div className="mb-2">
                      <div className="flex justify-between text-[9px] mb-0.5">
                        <span className="text-neutral-600">TRIGGER PROXIMITY</span>
                        <span className="text-purple-400 font-bold">CONVICTION {t.conviction_score.toFixed(1)}</span>
                      </div>
                      <div className="h-0.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${t.direction === 'BULLISH' ? 'bg-green-500' : 'bg-red-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="h-0.5 bg-neutral-800 rounded-full overflow-hidden mt-0.5">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${t.conviction_score}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Error message */}
                  {t.status === 'ERROR' && t.error_msg && (
                    <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1 mb-1">
                      {t.error_msg}
                    </div>
                  )}

                  {/* P&L row (once active) */}
                  {t.entry_price != null && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-neutral-500">
                        Fill: <span className="text-neutral-300">${fmt2(t.entry_price)}</span>
                        {t.triggered_at && <span className="text-neutral-600 ml-1">@ {fmtTime(t.triggered_at)}</span>}
                      </span>
                      {t.pnl != null && (
                        <span className={`font-bold ${t.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                          {t.close_reason && <span className="text-neutral-600 ml-1 text-[9px]">({t.close_reason})</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Expanded detail */}
                {isSel && (
                  <div className="px-3 pb-2">
                    <div className="bg-neutral-950 rounded p-2 border border-neutral-800 text-[10px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-neutral-500">ORDER ID</span>
                        <span className="text-neutral-400">{t.exit_order_id ?? t.id ?? '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-500">CONVICTION</span>
                        <span className="text-purple-400 font-bold">{t.conviction_score.toFixed(1)}</span>
                      </div>
                      {t.exit_price != null && (
                        <div className="flex justify-between">
                          <span className="text-neutral-500">EXIT FILL</span>
                          <span className="text-neutral-300">${fmt2(t.exit_price)}</span>
                        </div>
                      )}
                      <div className="text-neutral-500 mt-1">
                        Auto-execute when price {t.direction === 'BULLISH' ? '≤' : '≥'} ${fmt2(t.entry_trigger_price)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-neutral-800 text-[9px] text-neutral-600 shrink-0 flex justify-between">
        <span>MODEL-DRIVEN EXECUTION</span>
        <span className={autoEnabled ? 'text-purple-500' : 'text-neutral-600'}>
          {autoEnabled ? '● SCANNING PRICES' : '○ PAUSED'}
        </span>
      </div>
    </div>
  );
}
