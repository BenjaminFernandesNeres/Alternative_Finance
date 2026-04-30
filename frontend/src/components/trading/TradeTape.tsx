"use client";
import React, { useEffect, useState, useRef } from 'react';

interface Trade { id: string; symbol: string; price: number; size: number; side: 'buy' | 'sell'; time: string; }

let TRADE_ID = 0;
function genTrade(basePrice: number, symbol: string): Trade {
  const side = Math.random() > 0.5 ? 'buy' : 'sell';
  const price = basePrice + (Math.random() - 0.5) * 0.2;
  const size = Math.round(Math.random() * 500 + 10);
  const now = new Date();
  return {
    id: String(++TRADE_ID),
    symbol,
    price: parseFloat(price.toFixed(2)),
    size,
    side,
    time: now.toTimeString().slice(0, 8),
  };
}

export default function TradeTape({ symbol, latestPrice }: { symbol: string; latestPrice: number | null }) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = latestPrice ?? 245;
    // Generate initial trades
    const initial = Array.from({ length: 30 }, () => genTrade(base, symbol));
    setTrades(initial.reverse());

    const iv = setInterval(() => {
      const t = genTrade(latestPrice ?? base, symbol);
      setTrades(prev => [t, ...prev].slice(0, 200));
    }, 800 + Math.random() * 600);
    return () => clearInterval(iv);
  }, [symbol, latestPrice]);

  const buyVol = trades.slice(0, 50).filter(t => t.side === 'buy').reduce((a, t) => a + t.size, 0);
  const sellVol = trades.slice(0, 50).filter(t => t.side === 'sell').reduce((a, t) => a + t.size, 0);
  const totalVol = buyVol + sellVol;
  const buyPct = totalVol > 0 ? (buyVol / totalVol) * 100 : 50;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white tracking-wider">TRADE TAPE <span className="text-neutral-500 font-normal text-xs">{symbol}</span></h3>
          <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">LIVE</span>
        </div>
        {/* Buy/Sell ratio bar */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-green-400 font-bold w-8">{buyPct.toFixed(0)}%</span>
          <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-300" style={{ width: `${buyPct}%` }} />
          </div>
          <span className="text-red-400 font-bold w-8 text-right">{(100 - buyPct).toFixed(0)}%</span>
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-neutral-800 grid grid-cols-4 text-[9px] text-neutral-500 font-bold tracking-widest shrink-0">
        <span>TIME</span><span className="text-center">PRICE</span><span className="text-center">SIZE</span><span className="text-right">SIDE</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        {trades.map((t, i) => (
          <div key={t.id} className={`grid grid-cols-4 items-center px-3 py-0.5 text-[11px] border-b border-neutral-800/20 transition-colors ${i === 0 ? 'bg-neutral-800/50' : 'hover:bg-neutral-800/20'}`}>
            <span className="text-neutral-600">{t.time}</span>
            <span className={`text-center font-bold font-mono ${t.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>${t.price.toFixed(2)}</span>
            <span className="text-center text-neutral-300">{t.size.toLocaleString()}</span>
            <span className={`text-right font-bold uppercase text-[9px] ${t.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{t.side}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
