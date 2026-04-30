"use client";
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ArrowUp, ArrowDown, Activity, TrendingUp } from 'lucide-react';
import { apiUrl, WS_PRICES_URL } from '../lib/api';

// ── Types ──────────────────────────────────────────────────
interface TickerQuote {
  symbol: string;
  price: number;
  change: number;
  changeDollar: number;
  sparkline: number[];
}

interface PolyMarket {
  id: string;
  question: string;
  prob: number;     // 0-100
  trend: number;    // change in last 24h, pct points
  category: string;
  volume: string;
}

interface TickersProps {
  onSymbolChange?: (symbol: string) => void;
  activeSymbol?: string;
}

// ── Data ───────────────────────────────────────────────────
const SYMBOLS = ['AAPL', 'SPY', 'QQQ', 'GLD', 'USO', 'UNG', 'NVDA', 'MSFT', 'TSLA', 'META', 'AMZN', 'AMD', 'TLT', 'DXY', 'BTC'];

const POLY_MARKETS: PolyMarket[] = [
  { id: 'p1',  question: 'Russia-Ukraine ceasefire by end of 2025',  prob: 23, trend: +2.1,  category: 'GEO',     volume: '$4.2M' },
  { id: 'p2',  question: 'Iran nuclear deal signed in 2025',         prob: 18, trend: -1.4,  category: 'GEO',     volume: '$2.8M' },
  { id: 'p3',  question: 'Brent crude oil above $100 in 2025',       prob: 34, trend: +5.8,  category: 'ENERGY',  volume: '$6.1M' },
  { id: 'p4',  question: 'Taiwan military conflict before 2026',     prob:  7, trend: +0.3,  category: 'RISK',    volume: '$9.4M' },
  { id: 'p5',  question: 'US Fed rate cut in Q2 2025',               prob: 61, trend: +3.2,  category: 'MACRO',   volume: '$12.7M' },
  { id: 'p6',  question: 'Gold above $2,500 in 2025',                prob: 58, trend: +4.1,  category: 'METALS',  volume: '$3.3M' },
  { id: 'p7',  question: 'North Korea nuclear test in 2025',         prob: 12, trend: -0.8,  category: 'RISK',    volume: '$1.9M' },
  { id: 'p8',  question: 'US recession in 2025',                     prob: 31, trend: -2.3,  category: 'MACRO',   volume: '$8.5M' },
  { id: 'p9',  question: 'Houthi Red Sea attacks continue Q2',       prob: 77, trend: +1.6,  category: 'GEO',     volume: '$2.1M' },
  { id: 'p10', question: 'Saudi Arabia OPEC+ production cut Q3',     prob: 44, trend: +6.4,  category: 'ENERGY',  volume: '$5.0M' },
  { id: 'p11', question: 'China GDP growth above 4.5% in 2025',      prob: 52, trend: -1.1,  category: 'MACRO',   volume: '$3.7M' },
  { id: 'p12', question: 'Bitcoin above $150k before 2026',          prob: 41, trend: +7.2,  category: 'CRYPTO',  volume: '$14.3M' },
];

const CATEGORY_COLORS: Record<string, string> = {
  GEO:    '#ef4444',
  ENERGY: '#f59e0b',
  RISK:   '#f97316',
  MACRO:  '#3b82f6',
  METALS: '#a78bfa',
  CRYPTO: '#fbbf24',
};

// ── Sparkline ──────────────────────────────────────────────
function generateSpark(price: number, changePct: number, n = 22): number[] {
  const start = price / (1 + changePct / 100);
  const pts: number[] = [];
  let p = start;
  for (let i = 0; i < n - 1; i++) {
    p += (Math.random() - 0.49) * p * 0.003;
    pts.push(p);
  }
  pts.push(price);
  return pts;
}

function Sparkline({ data, up }: { data: number[]; up: boolean }) {
  if (!data || data.length < 2) return <div className="w-16 h-7" />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 64, h = 28;
  const xs = data.map((_, i) => (i / (data.length - 1)) * w);
  const ys = data.map(v => h - 2 - ((v - min) / range) * (h - 4));
  const line = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const color = up ? '#10b981' : '#ef4444';
  const gid = `sg-${up ? 'u' : 'd'}-${data.length}`;
  return (
    <svg width={w} height={h} className="opacity-90">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0"  />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Probability arc ────────────────────────────────────────
function ProbArc({ prob, color }: { prob: number; color: string }) {
  const r = 11, cx = 14, cy = 14;
  const circ = 2 * Math.PI * r;
  const dash = (prob / 100) * circ;
  return (
    <svg width={28} height={28} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="2.5" />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function Tickers({ onSymbolChange, activeSymbol }: TickersProps) {
  const [quotes, setQuotes] = useState<Record<string, TickerQuote>>({});
  const [polyMarkets] = useState<PolyMarket[]>(POLY_MARKETS);

  const mergeQuote = (raw: any) => {
    const price = raw.latest_trade?.price || raw.ask || raw.price || 0;
    const changePct = raw.change_pct ?? raw.change ?? (Math.random() * 4 - 2);
    const changeDollar = raw.change ?? (price * changePct / 100);
    if (!price) return;
    setQuotes(prev => {
      const existing = prev[raw.symbol];
      const spark = existing?.sparkline?.length >= 2
        ? [...existing.sparkline.slice(1), price]
        : generateSpark(price, changePct);
      return { ...prev, [raw.symbol]: { symbol: raw.symbol, price, change: changePct, changeDollar, sparkline: spark } };
    });
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const res = await fetch(apiUrl(`/market/multi-quote?symbols=${SYMBOLS.join(',')}`));
        if (res.ok) (await res.json()).forEach(mergeQuote);
      } catch {}
    };
    fetchAll();
    const iv = setInterval(fetchAll, 15000);

    let ws: WebSocket;
    const connectWS = () => {
      ws = new WebSocket(WS_PRICES_URL);
      ws.onmessage = (e) => {
        try {
          const p = JSON.parse(e.data);
          if (p.type === 'price_update') mergeQuote(p.data);
          if (p.type === 'snapshot') Object.values(p.data).forEach(mergeQuote);
        } catch {}
      };
      ws.onclose = () => setTimeout(connectWS, 5000);
    };
    connectWS();
    return () => { clearInterval(iv); ws?.close(); };
  }, []);

  const tickerList = useMemo(
    () => SYMBOLS.map(s => quotes[s] || { symbol: s, price: 0, change: 0, changeDollar: 0, sparkline: [] }),
    [quotes]
  );

  return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-neutral-950 border-b border-neutral-800 shadow-2xl select-none flex flex-col">

        {/* ── ROW 1: Market Tickers (h-16) ── */}
        <div className="flex items-stretch border-b border-neutral-800/60" style={{ height: 64 }}>

          {/* Brand */}
          <div className="flex items-center px-4 gap-2.5 border-r border-neutral-800 bg-gradient-to-b from-blue-600/15 to-blue-900/10 shrink-0 min-w-[100px]">
            <Activity className="w-4 h-4 text-blue-400" />
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-black text-blue-400 tracking-widest">WAR</span>
              <span className="text-[12px] font-black text-white tracking-widest">SIGNALS</span>
            </div>
          </div>

          {/* Scrolling ticker track */}
          <div className="flex-1 overflow-hidden relative">
            <div className="marquee-track-fast flex items-center h-full w-max">
              {/* Duplicated for seamless loop */}
              {[...tickerList, ...tickerList].map((q, i) => {
                const isUp    = q.change >= 0;
                const isActive = q.symbol === activeSymbol;
                return (
                  <button
                    key={`${q.symbol}-${i}`}
                    onClick={() => onSymbolChange?.(q.symbol)}
                    className={`flex items-center gap-3 px-5 h-full border-r border-neutral-800/50 hover:bg-neutral-800/60 transition-colors shrink-0 ${
                      isActive ? 'bg-blue-600/10 shadow-[inset_0_-2px_0_#3b82f6]' : ''
                    }`}
                  >
                    <div className="flex flex-col items-start gap-0">
                      <span className={`text-[11px] font-black tracking-widest ${isActive ? 'text-blue-400' : 'text-neutral-400'}`}>
                        {q.symbol}
                      </span>
                      <Sparkline data={q.sparkline} up={isUp} />
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[15px] font-bold text-white font-mono leading-tight">
                        {q.price > 0 ? `$${q.price.toFixed(2)}` : '—'}
                      </span>
                      <span className={`flex items-center gap-0.5 text-[11px] font-bold leading-none ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                        {isUp ? <ArrowUp size={9}/> : <ArrowDown size={9}/>}
                        {Math.abs(q.change).toFixed(2)}%
                      </span>
                      <span className={`text-[10px] font-mono leading-none ${isUp ? 'text-green-600' : 'text-red-600'}`}>
                        {isUp ? '+' : ''}{q.changeDollar.toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live dot */}
          <div className="flex items-center px-4 gap-2 border-l border-neutral-800 shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_6px_#22c55e]" />
            <span className="text-[10px] font-bold font-mono text-neutral-500 tracking-wider">LIVE</span>
          </div>
        </div>

        {/* ── ROW 2: Polymarket Predictions (h-10) ── */}
        <div className="flex items-center" style={{ height: 36 }}>

          {/* Label */}
          <div className="flex items-center gap-1.5 px-3 border-r border-neutral-800/60 shrink-0 h-full bg-purple-900/10">
            <TrendingUp className="w-3 h-3 text-purple-500" />
            <span className="text-[9px] font-black text-purple-400 tracking-[0.15em] whitespace-nowrap">POLYMARKET</span>
          </div>

          {/* Scrolling poly track */}
          <div className="flex-1 overflow-hidden relative">
            <div className="marquee-track-slow flex items-center h-full w-max gap-0">
              {[...polyMarkets, ...polyMarkets].map((m, i) => {
                const isUp    = m.trend >= 0;
                const color   = CATEGORY_COLORS[m.category] ?? '#6b7280';
                return (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex items-center gap-2.5 px-4 h-full border-r border-neutral-800/40 hover:bg-neutral-800/30 transition-colors cursor-pointer shrink-0"
                    title={`${m.question}\nVolume: ${m.volume}`}
                  >
                    <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color, background: color + '18', border: `1px solid ${color}30` }}>
                      {m.category}
                    </span>
                    <ProbArc prob={m.prob} color={color} />
                    <span className="text-[11px] font-black font-mono" style={{ color }}>{m.prob}%</span>
                    <span className="text-[11px] text-neutral-400 max-w-[220px] truncate">{m.question}</span>
                    <span className={`text-[10px] font-bold font-mono flex items-center gap-0.5 ${isUp ? 'text-green-500' : 'text-red-500'}`}>
                      {isUp ? <ArrowUp size={8}/> : <ArrowDown size={8}/>}
                      {Math.abs(m.trend).toFixed(1)}pp
                    </span>
                    <span className="text-[9px] text-neutral-600 font-mono">{m.volume}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
  );
}
