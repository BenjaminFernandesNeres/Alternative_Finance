"use client";
import React, { useEffect, useRef, useState } from 'react';
import { Zap, CheckCircle, ShieldAlert, Target, AlertTriangle, Radio } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface FeedEvent {
  id: string;
  ts: string;
  symbol: string;
  action: string;
  price: number | null;
  type: 'order_placed' | 'order_filled' | 'stop_triggered' | 'take_profit' | 'signal' | 'error';
  side?: 'buy' | 'sell';
  detail?: string;
}

const EVENT_CONFIG = {
  order_placed:   { icon: Zap,           color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20',   label: 'ORDER PLACED'   },
  order_filled:   { icon: CheckCircle,   color: 'text-green-400',  bg: 'bg-green-500/8 border-green-500/20', label: 'ORDER FILLED'   },
  stop_triggered: { icon: ShieldAlert,   color: 'text-red-400',    bg: 'bg-red-500/8 border-red-500/20',     label: 'STOP TRIGGERED' },
  take_profit:    { icon: Target,        color: 'text-emerald-400',bg: 'bg-emerald-500/8 border-emerald-500/20', label: 'TAKE PROFIT'  },
  signal:         { icon: Radio,         color: 'text-purple-400', bg: 'bg-purple-500/8 border-purple-500/20',   label: 'SIGNAL'       },
  error:          { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/8 border-orange-500/20',   label: 'ERROR'        },
};

let _evtId = 0;
function mkId() { return `evt_${++_evtId}`; }
function now() { return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

export default function LiveTradeFeed() {
  const [events, setEvents]     = useState<FeedEvent[]>([]);
  const [paused, setPaused]     = useState(false);
  const [lastOrderIds, setLast] = useState<Set<string>>(new Set());
  const bottomRef               = useRef<HTMLDivElement>(null);
  const scrollRef               = useRef<HTMLDivElement>(null);

  const addEvent = (evt: Omit<FeedEvent, 'id' | 'ts'>) => {
    if (paused) return;
    setEvents(prev => [{ ...evt, id: mkId(), ts: now() }, ...prev].slice(0, 200));
  };

  // Poll orders for real changes
  useEffect(() => {
    const poll = async () => {
      if (paused) return;
      try {
        const res = await fetch(apiUrl('/trading/orders?status=all'));
        if (!res.ok) return;
        const orders = await res.json();
        setLast(prev => {
          const next = new Set<string>();
          for (const o of orders) {
            next.add(o.id);
            if (!prev.has(o.id)) {
              // New order appeared
              addEvent({ symbol: o.symbol, action: `${o.order_type} ${o.side} placed`, price: o.limit_price || null, type: 'order_placed', side: o.side, detail: `qty ${o.qty}` });
            } else if (o.status === 'filled' && !prev.has(o.id + '_filled')) {
              addEvent({ symbol: o.symbol, action: `${o.order_type} ${o.side} filled`, price: o.filled_avg_price || null, type: 'order_filled', side: o.side, detail: `qty ${o.filled_qty} @ $${o.filled_avg_price}` });
              next.add(o.id + '_filled');
            }
          }
          prev.forEach(id => next.add(id)); // keep old
          return next;
        });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [paused]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_#22c55e]" />
          <h3 className="text-sm font-bold text-white tracking-wider">LIVE TRADE FEED</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-neutral-600">{events.length} events</span>
          <button
            onClick={() => setPaused(v => !v)}
            className={`text-[9px] font-bold px-2 py-0.5 rounded border transition-colors ${
              paused ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 'text-neutral-500 border-neutral-700 hover:border-neutral-500'
            }`}
          >
            {paused ? 'PAUSED' : 'PAUSE'}
          </button>
        </div>
      </div>

      {/* Event stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 p-2">
        {events.map(evt => {
          const cfg  = EVENT_CONFIG[evt.type];
          const Icon = cfg.icon;
          return (
            <div
              key={evt.id}
              className={`flex items-start gap-2.5 px-2.5 py-2 rounded border text-[11px] ${cfg.bg}`}
            >
              <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${cfg.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-white">{evt.symbol}</span>
                    <span className={`text-[9px] font-bold tracking-widest ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <span className="text-[9px] text-neutral-600 shrink-0">{evt.ts}</span>
                </div>
                <div className="text-neutral-400 truncate">{evt.action}
                  {evt.price !== null && <span className="text-neutral-500 ml-1">@ ${evt.price?.toFixed(2)}</span>}
                </div>
                {evt.detail && <div className="text-[10px] text-neutral-600 mt-0.5">{evt.detail}</div>}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
