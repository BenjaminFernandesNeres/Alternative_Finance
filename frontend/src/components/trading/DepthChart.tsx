"use client";
import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiUrl } from '../../lib/api';

interface DepthLevel { price: number; volume: number; cumVolume: number; }

function buildDepth(bid: number, ask: number, levels = 30) {
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  const step = Math.max((ask - bid) / levels, 0.01) * 2;
  let cumBid = 0, cumAsk = 0;
  for (let i = 0; i < levels; i++) {
    const vol = Math.max(Math.round(8000 * Math.exp(-i * 0.12) * (0.7 + Math.random() * 0.6)), 50);
    cumBid += vol;
    bids.push({ price: parseFloat((bid - i * step).toFixed(2)), volume: vol, cumVolume: cumBid });
  }
  for (let i = 0; i < levels; i++) {
    const vol = Math.max(Math.round(8000 * Math.exp(-i * 0.12) * (0.7 + Math.random() * 0.6)), 50);
    cumAsk += vol;
    asks.push({ price: parseFloat((ask + i * step).toFixed(2)), volume: vol, cumVolume: cumAsk });
  }
  return { bids: bids.reverse(), asks };
}

export default function DepthChart({ symbol }: { symbol: string }) {
  const [bid, setBid] = useState(245);
  const [ask, setAsk] = useState(245.5);
  const [depthData, setDepthData] = useState<ReturnType<typeof buildDepth>>({ bids: [], asks: [] });

  useEffect(() => { setDepthData(buildDepth(bid, ask, 25)); }, [bid, ask]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(apiUrl(`/market/orderbook/${symbol}?levels=20`));
        if (res.ok) {
          const d = await res.json();
          if (d.bid) setBid(d.bid);
          if (d.ask) setAsk(d.ask);
        }
      } catch {}
    };
    fetch_();
    const iv = setInterval(fetch_, 3000);
    return () => clearInterval(iv);
  }, [symbol]);

  const chartData = [
    ...depthData.bids.map(b => ({ price: b.price, bidDepth: b.cumVolume, askDepth: 0 })),
    ...depthData.asks.map(a => ({ price: a.price, bidDepth: 0, askDepth: a.cumVolume })),
  ];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">DEPTH CHART <span className="text-neutral-500 font-normal text-xs">{symbol}</span></h3>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-green-400">BID: ${bid.toFixed(2)}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-red-400">ASK: ${ask.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="price" tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${v}`} interval={9} />
            <YAxis tick={{ fill: '#525252', fontSize: 9 }} tickLine={false} axisLine={false}
              tickFormatter={v => v > 999 ? `${(v / 1000).toFixed(0)}k` : v} width={30} />
            <Tooltip contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }}
              formatter={(v: any, n: string) => [v?.toLocaleString(), n === 'bidDepth' ? 'Bid Depth' : 'Ask Depth']} />
            <Area type="stepAfter" dataKey="bidDepth" stroke="#10b981" strokeWidth={1.5} fill="url(#bidGrad)" dot={false} />
            <Area type="stepAfter" dataKey="askDepth" stroke="#ef4444" strokeWidth={1.5} fill="url(#askGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
