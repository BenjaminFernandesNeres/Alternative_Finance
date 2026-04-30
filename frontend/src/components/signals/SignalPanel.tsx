import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';

type LiveSignal = {
  id: string;
  symbol: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  conviction_score: number;
  entry_trigger_price?: number;
  current_price?: number;
  target_price?: number;
  stop_loss?: number;
  time_horizon_minutes?: number;
  rationale?: string;
};

export default function SignalPanel({ onSelectSymbol, onLoadChart }: {
  onSelectSymbol: (symbol: string) => void;
  onLoadChart?: (symbol: string) => void;
}) {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl('/signals/'));
        if (!res.ok) {
          setStatusMessage(`Signals API error (HTTP ${res.status})`);
          setSignals([]);
          return;
        }

        const payload = await res.json();
        if (Array.isArray(payload)) {
          setSignals(payload);
          setStatusMessage(payload.length === 0 ? 'No live signals available right now.' : null);
        } else {
          setSignals([]);
          setStatusMessage(payload?.message ?? 'Signals feed temporarily unavailable.');
        }
      } catch (e) {
        console.error(e);
        setSignals([]);
        setStatusMessage('Unable to reach live signals backend.');
      } finally {
        setLoading(false);
      }
    };
    fetchSignals();
    const iv = setInterval(fetchSignals, 10000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col font-mono text-xs">
      <div className="p-4 border-b border-neutral-800 shrink-0">
         <h2 className="text-lg font-bold text-white flex items-center justify-between">
            Model Engine Signals
            <span className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-[10px]">LIVE</span>
         </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {loading ? (
          <div className="text-center text-neutral-500 mt-10">Loading live signals...</div>
        ) : signals.length === 0 ? (
          <div className="text-center text-neutral-500 mt-10">{statusMessage ?? 'Waiting for signals computation...'}</div>
        ) : (
           signals.map(sig => (
             <div 
               key={sig.id} 
               onClick={() => onSelectSymbol(sig.symbol)}
               className="bg-neutral-950 border border-neutral-800 rounded p-3 cursor-pointer hover:border-blue-500/50 transition-colors group"
             >
               <div className="flex justify-between items-center mb-2">
                 <span className="text-white font-bold text-sm tracking-wider">{sig.symbol}</span>
                 <span className={`px-2 py-0.5 rounded font-bold uppercase ${
                    sig.direction === 'BULLISH' ? 'bg-green-500/10 text-green-500' :
                    sig.direction === 'BEARISH' ? 'bg-red-500/10 text-red-500' :
                    'bg-neutral-800 text-neutral-400'
                 }`}>{sig.direction}</span>
               </div>
               
               <div className="mb-3">
                 <div className="flex justify-between text-[9px] text-neutral-500 mb-1">
                   <span>CONVICTION SCORE</span>
                   <span>{sig.conviction_score.toFixed(1)}</span>
                 </div>
                 <div className="h-1 bg-neutral-900 rounded-full overflow-hidden">
                   <div 
                     className={`h-full ${sig.conviction_score > 70 ? 'bg-purple-500' : 'bg-blue-500'}`} 
                     style={{ width: `${Math.min(sig.conviction_score, 100)}%` }}
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-2 text-[10px] mt-2 mb-3">
                <div className="bg-neutral-900 p-1.5 rounded">
                  <span className="text-neutral-500 block mb-0.5">ENTRY</span>
                  <span className="text-blue-400 font-bold">${sig.entry_trigger_price ?? sig.current_price}</span>
                </div>
                 <div className="bg-neutral-900 p-1.5 rounded">
                    <span className="text-neutral-500 block mb-0.5">TARGET</span>
                    <span className="text-green-400 font-bold">${sig.target_price}</span>
                 </div>
                 <div className="bg-neutral-900 p-1.5 rounded">
                    <span className="text-neutral-500 block mb-0.5">STOP LOSS</span>
                    <span className="text-red-400 font-bold">${sig.stop_loss}</span>
                 </div>
                <div className="bg-neutral-900 p-1.5 rounded">
                  <span className="text-neutral-500 block mb-0.5">TIME HORIZON</span>
                  <span className="text-amber-300 font-bold">{sig.time_horizon_minutes ?? 240}m</span>
                </div>
               </div>

               <p className="text-[10px] text-neutral-400 mt-2 line-clamp-3 leading-relaxed border-t border-neutral-800 pt-2">
                 {sig.rationale}
               </p>

               <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button
                   onClick={(e) => { e.stopPropagation(); (onLoadChart ?? onSelectSymbol)(sig.symbol); }}
                   className="w-full bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold py-1.5 rounded hover:bg-blue-600/30">
                   Load Chart
                 </button>
               </div>
             </div>
           ))
        )}
      </div>
    </div>
  );
}
