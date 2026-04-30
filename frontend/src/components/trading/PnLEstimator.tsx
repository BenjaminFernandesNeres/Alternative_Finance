import React, { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api';

export default function PnLEstimator({ currentPrice }: { currentPrice: number | null }) {
  const [entry, setEntry] = useState(currentPrice ? String(currentPrice) : '');
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const [qty, setQty] = useState('1');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [estimate, setEstimate] = useState<any>(null);

  useEffect(() => {
    if (currentPrice && !entry) setEntry(String(currentPrice));
  }, [currentPrice, entry]);

  useEffect(() => {
    const e = parseFloat(entry);
    const t = parseFloat(target);
    const s = parseFloat(stop);
    const q = parseFloat(qty);
    
    if (e && t && s && q > 0) {
       const fetchEstimate = async () => {
         try {
           const res = await fetch(apiUrl('/portfolio/estimate-pnl'), {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ entry_price: e, target_price: t, stop_price: s, qty: q, side })
           });
           if (res.ok) setEstimate(await res.json());
         } catch(err) {
           console.error(err);
         }
       };
       fetchEstimate();
    } else {
       setEstimate(null);
    }
  }, [entry, target, stop, qty, side]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 font-mono flex flex-col h-full">
      <h3 className="font-bold text-lg text-white mb-4 border-b border-neutral-800 pb-2">P&L Estimator</h3>
      
      <div className="flex bg-neutral-950 rounded border border-neutral-800 p-1 mb-4">
        <button onClick={() => setSide('buy')} className={`flex-1 text-xs py-1.5 font-bold rounded transition-colors ${side === 'buy' ? 'bg-green-600/20 text-green-500' : 'text-neutral-500'}`}>LONG</button>
        <button onClick={() => setSide('sell')} className={`flex-1 text-xs py-1.5 font-bold rounded transition-colors ${side === 'sell' ? 'bg-red-600/20 text-red-500' : 'text-neutral-500'}`}>SHORT</button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">ENTRY PRICE</label>
          <input type="number" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">TARGET PRICE</label>
          <input type="number" step="0.01" value={target} onChange={e => setTarget(e.target.value)} className="w-full bg-neutral-950 border border-green-900/40 rounded p-1.5 text-sm text-green-400 focus:border-green-500" />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">STOP LOSS</label>
          <input type="number" step="0.01" value={stop} onChange={e => setStop(e.target.value)} className="w-full bg-neutral-950 border border-red-900/40 rounded p-1.5 text-sm text-red-400 focus:border-red-500" />
        </div>
        <div>
          <label className="text-[10px] text-neutral-500 block mb-1">SIZE</label>
          <input type="number" step="0.01" value={qty} onChange={e => setQty(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded p-1.5 text-sm text-white" />
        </div>
      </div>

      {estimate && (
        <div className="mt-4 pt-4 border-t border-neutral-800 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-neutral-950 p-2 rounded">
             <div className="text-[9px] text-neutral-500">EST PROFIT</div>
             <div className="text-green-500 font-bold">${estimate.estimated_profit.toFixed(2)}</div>
          </div>
          <div className="bg-neutral-950 p-2 rounded">
             <div className="text-[9px] text-neutral-500">EST LOSS</div>
             <div className="text-red-500 font-bold">${estimate.estimated_loss.toFixed(2)}</div>
          </div>
          <div className="bg-neutral-950 p-2 rounded col-span-2 flex justify-between">
             <span className="text-[10px] text-neutral-400">R/R RATIO</span>
             <span className="text-white font-bold">{estimate.risk_reward_ratio}</span>
          </div>
        </div>
      )}
    </div>
  );
}
