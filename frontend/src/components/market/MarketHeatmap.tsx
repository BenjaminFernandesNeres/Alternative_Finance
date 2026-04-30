"use client";
import React, { useState, useEffect } from 'react';

interface SectorData { name: string; change: number; marketCap: string; tickers: { sym: string; chg: number }[]; }

const SECTORS: SectorData[] = [
  { name: 'Energy', change: 2.4, marketCap: '4.2T', tickers: [{ sym: 'XOM', chg: 3.1 }, { sym: 'CVX', chg: 2.8 }, { sym: 'COP', chg: 1.9 }, { sym: 'USO', chg: 2.4 }] },
  { name: 'Technology', change: -0.8, marketCap: '14.1T', tickers: [{ sym: 'AAPL', chg: -0.5 }, { sym: 'MSFT', chg: -1.2 }, { sym: 'NVDA', chg: 0.4 }, { sym: 'META', chg: -1.8 }] },
  { name: 'Financials', change: 1.1, marketCap: '8.3T', tickers: [{ sym: 'JPM', chg: 1.5 }, { sym: 'BAC', chg: 0.9 }, { sym: 'GS', chg: 1.2 }, { sym: 'MS', chg: 0.7 }] },
  { name: 'Materials', change: 3.2, marketCap: '2.1T', tickers: [{ sym: 'GLD', chg: 2.9 }, { sym: 'NEM', chg: 3.8 }, { sym: 'FCX', chg: 2.1 }, { sym: 'AA', chg: 4.1 }] },
  { name: 'Healthcare', change: 0.3, marketCap: '6.7T', tickers: [{ sym: 'JNJ', chg: 0.4 }, { sym: 'UNH', chg: 0.1 }, { sym: 'PFE', chg: 0.8 }, { sym: 'ABBV', chg: -0.2 }] },
  { name: 'Industrials', change: -0.4, marketCap: '4.8T', tickers: [{ sym: 'GE', chg: -0.7 }, { sym: 'CAT', chg: 0.2 }, { sym: 'BA', chg: -1.9 }, { sym: 'LMT', chg: 2.3 }] },
  { name: 'Utilities', change: -1.2, marketCap: '1.4T', tickers: [{ sym: 'NEE', chg: -1.5 }, { sym: 'DUK', chg: -0.9 }, { sym: 'SO', chg: -1.3 }, { sym: 'AEP', chg: -1.1 }] },
  { name: 'Real Estate', change: -2.1, marketCap: '1.2T', tickers: [{ sym: 'AMT', chg: -2.3 }, { sym: 'PLD', chg: -1.8 }, { sym: 'CCI', chg: -2.4 }, { sym: 'EQIX', chg: -2.0 }] },
];

function heatColor(chg: number): string {
  if (chg > 3) return 'bg-emerald-700/90 border-emerald-600/40 text-emerald-100';
  if (chg > 1.5) return 'bg-emerald-800/80 border-emerald-700/30 text-emerald-200';
  if (chg > 0.5) return 'bg-emerald-900/70 border-emerald-800/30 text-emerald-300';
  if (chg > -0.5) return 'bg-neutral-800/60 border-neutral-700/30 text-neutral-300';
  if (chg > -1.5) return 'bg-red-900/60 border-red-800/30 text-red-300';
  if (chg > -3) return 'bg-red-800/80 border-red-700/30 text-red-200';
  return 'bg-red-700/90 border-red-600/40 text-red-100';
}

export default function MarketHeatmap({ onSymbolChange }: { onSymbolChange?: (s: string) => void }) {
  const [selected, setSelected] = useState<SectorData | null>(null);
  const [view, setView] = useState<'sector' | 'ticker'>('sector');

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">MARKET HEATMAP</h3>
        <div className="flex gap-1">
          {(['sector', 'ticker'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${view === v ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-3">
        {view === 'sector' ? (
          <div className="grid grid-cols-4 gap-1.5 h-full">
            {SECTORS.map(s => (
              <div key={s.name} onClick={() => { setSelected(s); setView('ticker'); }}
                className={`flex flex-col items-center justify-center p-2 rounded border cursor-pointer transition-all hover:opacity-90 hover:scale-[1.02] ${heatColor(s.change)}`}
                style={{ minHeight: 80 }}>
                <div className="text-[11px] font-bold text-center leading-tight">{s.name}</div>
                <div className="text-base font-black mt-1">{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</div>
                <div className="text-[9px] opacity-60">{s.marketCap}</div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <button onClick={() => setView('sector')} className="text-[10px] text-neutral-500 hover:text-white mb-3 flex items-center gap-1">
              ← Back to sectors {selected && `/ ${selected.name}`}
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {(selected?.tickers ?? SECTORS.flatMap(s => s.tickers)).map(t => (
                <button key={t.sym} onClick={() => onSymbolChange?.(t.sym)}
                  className={`flex items-center justify-between p-2 rounded border cursor-pointer transition-all hover:opacity-90 ${heatColor(t.chg)}`}>
                  <span className="font-bold text-sm">{t.sym}</span>
                  <span className="text-sm font-bold">{t.chg >= 0 ? '+' : ''}{t.chg.toFixed(2)}%</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
