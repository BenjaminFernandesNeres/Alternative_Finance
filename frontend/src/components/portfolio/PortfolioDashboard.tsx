import React, { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';

export default function PortfolioDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        const res = await fetch(apiUrl('/portfolio/summary'));
        if (res.ok) setData(await res.json());
      } catch (e) {
        console.error("Portfolio fetch failed", e);
      }
    };
    fetchPortfolio();
    const iv = setInterval(fetchPortfolio, 5000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg p-6 flex items-center justify-center font-mono text-neutral-500">Loading Portfolio...</div>;

  const { totals, positions } = data;

  return (
    <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg p-5 font-mono flex flex-col">
      <h2 className="text-lg font-bold text-white mb-4 border-b border-neutral-800 pb-2">Portfolio Overview</h2>
      
      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
          <div className="text-[10px] text-neutral-500 mb-1">EQUITY VALUE</div>
          <div className="text-xl font-bold text-white">${totals.portfolio_value.toLocaleString()}</div>
        </div>
        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
          <div className="text-[10px] text-neutral-500 mb-1">CASH AVAILABLE</div>
          <div className="text-xl font-bold text-neutral-300">${totals.cash.toLocaleString()}</div>
        </div>
        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
          <div className="text-[10px] text-neutral-500 mb-1">DAY P&L</div>
          <div className={`text-xl font-bold ${totals.daily_pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
             {totals.daily_pnl >= 0 ? '+' : ''}${totals.daily_pnl.toFixed(2)} ({totals.daily_pnl_pct.toFixed(2)}%)
          </div>
        </div>
        <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
          <div className="text-[10px] text-neutral-500 mb-1">UNREALIZED P&L</div>
          <div className={`text-xl font-bold ${totals.total_unrealized_pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
             {totals.total_unrealized_pl >= 0 ? '+' : ''}${totals.total_unrealized_pl.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      <h3 className="text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">Open Positions</h3>
      <div className="flex-1 overflow-y-auto custom-scrollbar border border-neutral-800 rounded bg-neutral-950">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="bg-neutral-900 text-neutral-500 text-[10px] sticky top-0">
            <tr>
              <th className="p-2 font-bold w-1/4">SYMBOL</th>
              <th className="p-2 font-bold w-1/4">QTY</th>
              <th className="p-2 font-bold w-1/4 text-right">AVG ENTRY</th>
              <th className="p-2 font-bold w-1/4 text-right">UNREALIZED</th>
            </tr>
          </thead>
          <tbody>
            {positions.length === 0 ? (
               <tr><td colSpan={4} className="p-4 text-center text-neutral-600">No open positions</td></tr>
            ) : (
               positions.map((p: any, i: number) => (
                 <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                   <td className="p-2 font-bold text-white">{p.symbol}</td>
                   <td className="p-2">{p.qty}</td>
                   <td className="p-2 text-right">${p.avg_entry_price.toFixed(2)}</td>
                   <td className={`p-2 font-bold text-right ${p.unrealized_pl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                     {p.unrealized_pl >= 0 ? '+' : ''}${p.unrealized_pl.toFixed(2)}
                   </td>
                 </tr>
               ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
