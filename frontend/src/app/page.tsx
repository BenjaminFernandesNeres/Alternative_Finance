"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { apiUrl, barsUrl, WS_PRICES_URL } from '../lib/api';

const DEFAULT_SYMBOL = 'AAPL';

import Tickers          from '../components/Tickers';
import CandlestickChart from '../components/charts/CandlestickChart';
import OrderBook        from '../components/orderbook/OrderBook';
import TradingPanel     from '../components/trading/TradingPanel';
import OrdersList       from '../components/trading/OrdersList';
import OpenTrades       from '../components/trading/OpenTrades';
import LiveTradeFeed    from '../components/trading/LiveTradeFeed';
import StrategyMonitor  from '../components/trading/StrategyMonitor';
import AutoTradeMonitor from '../components/trading/AutoTradeMonitor';
import DepthChart       from '../components/trading/DepthChart';
import TradeTape        from '../components/trading/TradeTape';
import SignalPanel      from '../components/signals/SignalPanel';
import NewsPanel        from '../components/news/NewsPanel';
import SatelliteIntel  from '../components/map/SatelliteIntel';
import PortfolioPie     from '../components/portfolio/PortfolioPie';
import EquityCurve      from '../components/portfolio/EquityCurve';
import PnLDashboard     from '../components/portfolio/PnLDashboard';
import MarketHeatmap    from '../components/market/MarketHeatmap';
import VolatilityTracker from '../components/market/VolatilityTracker';
import PnLEstimator     from '../components/trading/PnLEstimator';

import {
  Globe, LineChart, PanelRightClose, PanelRightOpen,
  ChevronDown, ChevronUp, Activity, BarChart2, Layers,
  TrendingUp, Briefcase, Radio, Wifi, WifiOff,
} from 'lucide-react';

const GlobeMap = dynamic(() => import('../components/map/GlobeMap'), { ssr: false });

// ── Section wrapper ───────────────────────────────────────
function Section({ id, title, icon: Icon, badge, defaultOpen = true, children }: {
  id: string; title: string; icon: React.ElementType; badge?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="border-t border-neutral-800/80">
      <div
        className="flex items-center justify-between px-4 py-2 bg-neutral-950/80 cursor-pointer hover:bg-neutral-900/60 transition-colors select-none"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="w-3.5 h-3.5 text-neutral-500" />
          <span className="text-[10px] font-black tracking-[0.15em] text-neutral-400 uppercase">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-neutral-700" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-700" />}
      </div>
      {open && children}
    </section>
  );
}

// ── Status indicator ──────────────────────────────────────
type SysStatus = 'LIVE' | 'CONNECTING' | 'PAUSED' | 'ERROR';

function StatusBadge({ status }: { status: SysStatus }) {
  const cfg = {
    LIVE:       { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/25',  dot: 'bg-green-400',  label: 'LIVE'       },
    CONNECTING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/25',dot: 'bg-yellow-400', label: 'CONNECTING' },
    PAUSED:     { color: 'text-neutral-400',bg: 'bg-neutral-800 border-neutral-700',    dot: 'bg-neutral-400',label: 'PAUSED'     },
    ERROR:      { color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/25',      dot: 'bg-red-400',    label: 'ERROR'      },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${status === 'LIVE' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

// ── Main Terminal ─────────────────────────────────────────
export default function Terminal() {
  const [symbol,     setSymbol]     = useState(DEFAULT_SYMBOL);
  const [centerView, setCenterView] = useState<'chart' | 'map'>('map');
  const [leftTab,    setLeftTab]    = useState<'signals' | 'geoint'>('geoint');
  const [chartData,  setChartData]  = useState<any[]>([]);
  const [latestPrice,setLatestPrice]= useState<number | null>(null);
  const [showNews,   setShowNews]   = useState(true);
  const [sysStatus,  setSysStatus]  = useState<SysStatus>('CONNECTING');
  const [lastSignal, setLastSignal] = useState<string>('—');
  const [lastExec,   setLastExec]   = useState<string>('—');
  const [signals,    setSignals]    = useState<any[]>([]);

  // Real-time chart + WS connection
  useEffect(() => {
    let ws: WebSocket;
    let active = true;
    setSysStatus('CONNECTING');
    // Prevent showing stale price from previously selected symbol.
    setLatestPrice(null);

    const loadBars = async () => {
      try {
        const res = await fetch(barsUrl(symbol, '1Day', 60));
        if (res.ok && active) {
          const data = await res.json();
          setChartData(data.bars || []);
        }
      } catch {}
    };
    loadBars();

    const connectWS = () => {
      try {
        ws = new WebSocket(WS_PRICES_URL);
        ws.onopen    = () => { if (active) setSysStatus('LIVE'); };
        ws.onmessage = (event) => {
          try {
            const p = JSON.parse(event.data);
            if (p.type === 'price_update' && p.data.symbol === symbol) {
              // Prefer trade price; for quote-only messages fall back to ask then bid
              const newPrice = p.data.type === 'trade'
                ? p.data.price
                : (p.data.ask ?? p.data.bid);
              if (newPrice && active) {
                setLatestPrice(newPrice);
                setChartData(prev => {
                  if (prev.length === 0) return prev;
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, close: newPrice, high: Math.max(last.high, newPrice), low: Math.min(last.low, newPrice) }];
                });
              }
            }
          } catch {}
        };
        ws.onclose = () => { if (active) { setSysStatus('CONNECTING'); setTimeout(connectWS, 5000); } };
        ws.onerror = () => { if (active) setSysStatus('ERROR'); };
      } catch { if (active) setSysStatus('ERROR'); }
    };
    connectWS();
    return () => { active = false; ws?.close(); };
  }, [symbol]);

  // Poll signals for lastSignal timestamp
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(apiUrl('/signals/'));
        if (res.ok) {
          const data = await res.json();
          setSignals(Array.isArray(data) ? data : []);
          setLastSignal(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => clearInterval(iv);
  }, []);

  const handleLoadChart = (sym: string) => { setSymbol(sym); setCenterView('chart'); };

  const activeSignal = signals.find((s: any) => String(s.symbol).toUpperCase() === symbol.toUpperCase());
  const chartLevels = activeSignal
    ? {
        entry: Number(activeSignal.entry_trigger_price ?? activeSignal.current_price ?? latestPrice ?? 0),
        target: Number(activeSignal.target_price ?? 0),
        stop: Number(activeSignal.stop_loss ?? 0),
      }
    : null;

  const systemBadge = <StatusBadge status={sysStatus} />;

  return (
    <div className="min-h-screen w-screen bg-neutral-950 text-neutral-100 flex flex-col font-mono">

      {/* ── Fixed Ticker Bar ── */}
      <Tickers activeSymbol={symbol} onSymbolChange={s => { setSymbol(s); setCenterView('chart'); }} />
      <div className="h-[100px] shrink-0" />

      {/* ══════════════════════════════════════
          SECTION 1: MAIN TRADING TERMINAL
          ══════════════════════════════════════ */}
      <Section id="terminal" title="Trading Terminal" icon={LineChart} badge={systemBadge}>
        <div className="h-[calc(100vh-136px)] flex gap-2 p-2">

          {/* Left: Signals | GEOINT Intel */}
          <div className="w-[290px] flex flex-col gap-2 shrink-0">
            {/* Tab switcher */}
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setLeftTab('signals')}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-colors ${leftTab === 'signals' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}
              >SIGNALS</button>
              <button
                onClick={() => setLeftTab('geoint')}
                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold tracking-wider transition-colors ${leftTab === 'geoint' ? 'bg-sky-900/60 text-sky-300' : 'text-neutral-500 hover:text-neutral-300'}`}
              >SAT INTEL</button>
            </div>

            {leftTab === 'signals' ? (
              <>
                <div className="flex-1 min-h-0">
                  <SignalPanel onSelectSymbol={setSymbol} onLoadChart={handleLoadChart} />
                </div>
                <div className="h-[240px] shrink-0">
                  <PnLEstimator currentPrice={latestPrice} />
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0">
                <SatelliteIntel />
              </div>
            )}
          </div>

          {/* Center: Chart / Globe */}
          <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden relative min-w-0 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-950/60 shrink-0">
              <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 p-0.5 rounded-md">
                <button onClick={() => { setCenterView('chart'); setLeftTab('signals'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${centerView === 'chart' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  <LineChart className="w-3.5 h-3.5" /> Chart
                </button>
                <button onClick={() => { setCenterView('map'); setLeftTab('geoint'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${centerView === 'map' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-500 hover:text-neutral-300'}`}>
                  <Globe className="w-3.5 h-3.5" /> Global Map
                </button>
              </div>
              {centerView === 'chart' ? (
                <div className="flex items-center gap-2">
                  <div className="text-neutral-400 font-mono text-sm">{symbol} — Realtime</div>
                  {latestPrice && <div className="text-white font-black text-sm">${latestPrice.toFixed(2)}</div>}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="text-neutral-400 font-mono text-xs flex gap-3">
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Events</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Missiles</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Vessels</span>
                  </div>
                  <button onClick={() => setShowNews(v => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-neutral-400 hover:text-neutral-200 border border-neutral-800 hover:border-neutral-600 transition-colors">
                    {showNews ? <PanelRightClose className="w-3 h-3" /> : <PanelRightOpen className="w-3 h-3" />}
                    {showNews ? 'Hide' : 'News'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 relative flex min-h-0">
              {centerView === 'chart' ? (
                <div className="absolute inset-0">
                  {chartData.length > 0
                    ? <CandlestickChart data={chartData} symbol={symbol} levels={chartLevels ?? undefined} />
                    : <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">Loading {symbol}…</div>
                  }
                </div>
              ) : (
                <div className="absolute inset-0 flex gap-2 p-2">
                  <div className="flex-1 relative rounded-lg overflow-hidden"><GlobeMap /></div>
                  {showNews && <div className="w-[268px] shrink-0"><NewsPanel /></div>}
                </div>
              )}
            </div>
          </div>

          {/* Right: OrderBook + Trading */}
          <div className="w-[310px] flex flex-col gap-2 shrink-0">
            <div className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden min-h-0">
              <OrderBook symbol={symbol} />
            </div>
            <div className="h-[360px] shrink-0">
              <TradingPanel symbol={symbol} latestPrice={latestPrice} />
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 2: LIVE TRADE MONITORING
          ══════════════════════════════════════ */}
      <Section id="live-monitoring" title="Live Trade Monitoring" icon={Activity}
        badge={<span className="text-[9px] text-green-500 font-bold bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded">REALTIME</span>}>
        <div className="grid grid-cols-3 gap-2 p-2" style={{ height: 420 }}>
          <div className="col-span-2">
            <OpenTrades
              onSelectSymbol={s => { setSymbol(s); setCenterView('chart'); }}
              activeSymbol={symbol}
              livePrice={latestPrice}
            />
          </div>
          <LiveTradeFeed />
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 3: ORDER MANAGEMENT
          ══════════════════════════════════════ */}
      <Section id="orders" title="Order Management" icon={Layers}>
        <div className="p-2" style={{ height: 320 }}>
          <OrdersList />
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 4: P&L & STRATEGY
          ══════════════════════════════════════ */}
      <Section id="pnl-strategy" title="P&L & Strategy Performance" icon={BarChart2}>
        <div className="grid grid-cols-3 gap-2 p-2" style={{ height: 460 }}>
          <div className="col-span-2">
            <PnLDashboard />
          </div>
          <StrategyMonitor symbol={symbol} />
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 5: PORTFOLIO COMPOSITION
          ══════════════════════════════════════ */}
      <Section id="portfolio" title="Portfolio Composition" icon={Briefcase}>
        <div className="grid grid-cols-3 gap-2 p-2" style={{ height: 380 }}>
          <PortfolioPie />
          <div className="col-span-2">
            <EquityCurve />
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 6: AUTO-TRADE ENGINE
          ══════════════════════════════════════ */}
      <Section id="autotrade" title="Auto-Trade Engine" icon={Radio}>
        <div className="grid grid-cols-3 gap-2 p-2" style={{ height: 400 }}>
          <AutoTradeMonitor />
          <DepthChart symbol={symbol} />
          <TradeTape symbol={symbol} latestPrice={latestPrice} />
        </div>
      </Section>

      {/* ══════════════════════════════════════
          SECTION 7: MARKET INTELLIGENCE
          ══════════════════════════════════════ */}
      <Section id="market-intel" title="Market Intelligence" icon={TrendingUp} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2 p-2" style={{ height: 380 }}>
          <MarketHeatmap onSymbolChange={setSymbol} />
          <VolatilityTracker />
        </div>
      </Section>

      {/* System status bar */}
      <div className="sticky bottom-0 z-40 bg-neutral-950/90 backdrop-blur-md border-t border-neutral-800/60 px-4 py-1.5 flex items-center justify-between text-[9px] font-mono text-neutral-600">
        <div className="flex items-center gap-4">
          <StatusBadge status={sysStatus} />
          <span>{sysStatus === 'LIVE' ? <Wifi className="w-3 h-3 text-green-500 inline mr-1" /> : <WifiOff className="w-3 h-3 text-red-500 inline mr-1" />}WebSocket</span>
          <span>Last Signal: <span className="text-neutral-500">{lastSignal}</span></span>
          <span>Symbol: <span className="text-blue-400 font-bold">{symbol}</span></span>
        </div>
        <div className="flex items-center gap-4">
          <span>WAR SIGNALS TERMINAL v2.0</span>
          <span className="text-neutral-700">PAPER TRADING</span>
        </div>
      </div>

      <div className="h-4 shrink-0" />
    </div>
  );
}
