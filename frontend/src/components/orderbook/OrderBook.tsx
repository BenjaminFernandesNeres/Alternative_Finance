import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';

interface OrderBookLevel {
  price: number;
  volume: number;
}

interface OrderBookData {
  symbol: string;
  bid: number;
  ask: number;
  spread: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export default function OrderBook({ symbol }: { symbol: string }) {
  const [data, setData] = useState<OrderBookData | null>(null);

  useEffect(() => {
    let active = true;
    const fetchOB = async () => {
      try {
        const res = await fetch(apiUrl(`/market/orderbook/${symbol}?levels=12`));
        if (res.ok && active) setData(await res.json());
      } catch (e) {
        console.error("OB fetch failed", e);
      }
    };

    fetchOB();
    const iv = setInterval(fetchOB, 2000); // Poll simulated OB
    return () => { active = false; clearInterval(iv); };
  }, [symbol]);

  if (!data) return <div className="p-4 text-xs text-neutral-500 font-mono flex items-center h-full justify-center">Loading OB...</div>;

  const maxVol = Math.max(
    ...(data.bids.map(b => b.volume) || [1]),
    ...(data.asks.map(a => a.volume) || [1])
  );

  return (
    <div className="flex flex-col h-full bg-neutral-950 font-mono text-[11px] select-none">
      <div className="flex justify-between px-3 py-2 border-b border-neutral-800 text-neutral-500 font-bold sticky top-0 bg-neutral-950/90 z-10">
         <span className="w-1/3">PRICE</span>
         <span className="w-1/3 text-right">SIZE</span>
         <span className="w-1/3 text-right">TOTAL</span>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-center">
        {/* ASKS (Reverse order to show cheapest ask at bottom) */}
        <div className="flex flex-col">
          {[...data.asks].reverse().map((ask, i) => {
             const width = `${(ask.volume / maxVol) * 100}%`;
             return (
               <div key={`ask-${i}`} className="flex justify-between px-3 py-0.5 relative group hover:bg-neutral-900 cursor-pointer">
                 <div className="absolute right-0 top-0 bottom-0 bg-red-500/10 transition-all" style={{ width }} />
                 <span className="w-1/3 text-red-500 font-bold z-10">{ask.price.toFixed(2)}</span>
                 <span className="w-1/3 text-right text-neutral-300 z-10">{ask.volume}</span>
                 <span className="w-1/3 text-right text-neutral-500 z-10">{(ask.price * ask.volume).toLocaleString(undefined, { maximumFractionDigits: 0})}</span>
               </div>
             )
          })}
        </div>

        {/* SPREAD */}
        <div className="flex items-center justify-between px-3 py-2 my-1 border-y border-neutral-800 bg-neutral-900/50">
          <span className="text-yellow-500 font-bold tracking-widest">{data.spread.toFixed(2)}</span>
          <span className="text-neutral-500">SPREAD</span>
        </div>

        {/* BIDS */}
        <div className="flex flex-col">
          {data.bids.map((bid, i) => {
             const width = `${(bid.volume / maxVol) * 100}%`;
             return (
               <div key={`bid-${i}`} className="flex justify-between px-3 py-0.5 relative group hover:bg-neutral-900 cursor-pointer">
                 <div className="absolute left-0 top-0 bottom-0 bg-green-500/10 transition-all" style={{ width }} />
                 <span className="w-1/3 text-green-500 font-bold z-10">{bid.price.toFixed(2)}</span>
                 <span className="w-1/3 text-right text-neutral-300 z-10">{bid.volume}</span>
                 <span className="w-1/3 text-right text-neutral-500 z-10">{(bid.price * bid.volume).toLocaleString(undefined, { maximumFractionDigits: 0})}</span>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  );
}
