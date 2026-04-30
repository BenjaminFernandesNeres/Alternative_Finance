"use client";
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Eye, Send, ChevronDown } from 'lucide-react';
import { apiUrl } from '../../lib/api';

// Default risk/reward percentages for auto-filled fields
const DEFAULT_STOP_PCT = 0.03;  // 3% from entry
const DEFAULT_TP_PCT   = 0.05;  // 5% from entry

interface TradingPanelProps {
  symbol: string;
  latestPrice: number | null;
  onOrderPlaced?: () => void;
}

type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit' | 'take_profit';

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  market:      'Market',
  limit:       'Limit',
  stop:        'Stop',
  stop_limit:  'Stop-Limit',
  take_profit: 'Take Profit',
};

interface Preview {
  estCost: number;
  potentialProfit: number;
  potentialLoss: number;
  riskReward: number;
}

function calcPreview(side: 'buy' | 'sell', qty: number, price: number, limitPrice: number | null, stopPrice: number | null, tpPrice: number | null): Preview | null {
  if (!qty || !price) return null;
  const entry  = limitPrice ?? price;
  const stop   = stopPrice  ?? (side === 'buy' ? entry * (1 - DEFAULT_STOP_PCT) : entry * (1 + DEFAULT_STOP_PCT));
  const target = tpPrice    ?? (side === 'buy' ? entry * (1 + DEFAULT_TP_PCT)   : entry * (1 - DEFAULT_TP_PCT));
  const estCost        = entry * qty;
  const potentialProfit = Math.abs(target - entry) * qty;
  const potentialLoss  = Math.abs(entry  - stop)   * qty;
  const riskReward     = potentialLoss !== 0 ? potentialProfit / potentialLoss : 0;
  return { estCost, potentialProfit, potentialLoss: -potentialLoss, riskReward };
}

function InputField({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-[9px] uppercase text-neutral-500 font-bold tracking-widest block mb-1">{label}</label>
      <input
        type="number" step="0.01" min="0"
        required={required}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors font-mono placeholder-neutral-700"
      />
    </div>
  );
}

export default function TradingPanel({ symbol, latestPrice, onOrderPlaced }: TradingPanelProps) {
  const [side,        setSide]        = useState<'buy' | 'sell'>('buy');
  const [orderType,   setOrderType]   = useState<OrderType>('market');
  const [qty,         setQty]         = useState('');
  const [limitPrice,  setLimitPrice]  = useState('');
  const [stopPrice,   setStopPrice]   = useState('');
  const [tpPrice,     setTpPrice]     = useState('');
  const [tif,         setTif]         = useState('day');
  const [showPreview, setShowPreview] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  const price = latestPrice ?? 0;
  const qtyN  = parseFloat(qty)        || 0;
  const limN  = parseFloat(limitPrice) || null;
  const stpN  = parseFloat(stopPrice)  || null;
  const tpN   = parseFloat(tpPrice)    || null;

  const preview = showPreview && qtyN > 0 ? calcPreview(side, qtyN, price, limN, stpN, tpN) : null;

  const needsLimit = ['limit', 'stop_limit'].includes(orderType);
  const needsStop  = ['stop', 'stop_limit'].includes(orderType);
  const needsTp    = orderType === 'take_profit';

  useEffect(() => {
    if (!latestPrice) return;
    if (needsLimit && !limitPrice) setLimitPrice(latestPrice.toFixed(2));
    if (needsStop  && !stopPrice)  setStopPrice((side === 'buy'
      ? latestPrice * (1 - DEFAULT_STOP_PCT)
      : latestPrice * (1 + DEFAULT_STOP_PCT)).toFixed(2));
    if (needsTp    && !tpPrice)    setTpPrice((side === 'buy'
      ? latestPrice * (1 + DEFAULT_TP_PCT)
      : latestPrice * (1 - DEFAULT_TP_PCT)).toFixed(2));
  }, [orderType, side, latestPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null); setSuccess(null);
    try {
      const apiType = orderType === 'take_profit' ? 'limit' : orderType;
      const payload: any = { symbol, qty: qtyN, side, order_type: apiType, time_in_force: tif };
      if (needsLimit)  payload.limit_price = limN;
      if (needsStop)   payload.stop_price  = stpN;
      if (needsTp)     payload.limit_price = tpN;

      const res  = await fetch(apiUrl('/trading/orders'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Order rejected');
      setSuccess(`${side.toUpperCase()} ${qty} ${symbol} submitted`);
      setQty(''); setLimitPrice(''); setStopPrice(''); setTpPrice('');
      onOrderPlaced?.();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <div>
          <div className="text-white font-black text-base">{symbol}</div>
          <div className="text-[9px] text-neutral-600 tracking-widest">ORDER ENTRY</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-black font-mono ${latestPrice ? 'text-white' : 'text-neutral-600'}`}>
            {latestPrice ? `$${latestPrice.toFixed(2)}` : '—'}
          </div>
          <div className="text-[9px] text-neutral-600">LAST PRICE</div>
        </div>
      </div>

      <div className="flex border-b border-neutral-800 shrink-0">
        <button onClick={() => setSide('buy')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${side === 'buy' ? 'bg-green-500/10 text-green-400 border-b-2 border-green-500' : 'text-neutral-500 hover:text-neutral-300'}`}>
          <TrendingUp className="w-3.5 h-3.5" />BUY / LONG
        </button>
        <button onClick={() => setSide('sell')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold transition-all ${side === 'sell' ? 'bg-red-500/10 text-red-400 border-b-2 border-red-500' : 'text-neutral-500 hover:text-neutral-300'}`}>
          <TrendingDown className="w-3.5 h-3.5" />SELL / SHORT
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto custom-scrollbar">
        <div>
          <label className="text-[9px] uppercase text-neutral-500 font-bold tracking-widest block mb-1.5">ORDER TYPE</label>
          <div className="grid grid-cols-5 gap-1">
            {(Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map(type => (
              <button key={type} type="button" onClick={() => setOrderType(type)}
                className={`py-1.5 text-[9px] font-bold rounded border transition-all leading-tight ${orderType === type ? 'bg-blue-500/15 text-blue-400 border-blue-500/40' : 'text-neutral-500 border-neutral-800 hover:border-neutral-600'}`}>
                {ORDER_TYPE_LABELS[type].toUpperCase().replace('-', '‑')}
              </button>
            ))}
          </div>
        </div>

        <InputField label="Quantity (Shares)" value={qty} onChange={setQty} placeholder="0" required />
        {needsLimit && <InputField label="Limit Price" value={limitPrice} onChange={setLimitPrice} placeholder={latestPrice?.toFixed(2) ?? '0.00'} required />}
        {needsStop  && <InputField label="Stop Price"  value={stopPrice}  onChange={setStopPrice}  placeholder={(side === 'buy' ? (latestPrice ?? 0) * (1 - DEFAULT_STOP_PCT) : (latestPrice ?? 0) * (1 + DEFAULT_STOP_PCT)).toFixed(2)} required />}
        {needsTp    && <InputField label="Take Profit Price" value={tpPrice} onChange={setTpPrice} placeholder={(side === 'buy' ? (latestPrice ?? 0) * (1 + DEFAULT_TP_PCT) : (latestPrice ?? 0) * (1 - DEFAULT_TP_PCT)).toFixed(2)} required />}

        <div>
          <label className="text-[9px] uppercase text-neutral-500 font-bold tracking-widest block mb-1">TIME IN FORCE</label>
          <select value={tif} onChange={e => setTif(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-2 text-sm text-neutral-200 outline-none focus:border-blue-500/50">
            <option value="day">Day</option>
            <option value="gtc">Good Till Cancelled</option>
            <option value="ioc">Immediate or Cancel</option>
            <option value="fok">Fill or Kill</option>
          </select>
        </div>

        <button type="button" onClick={() => setShowPreview(v => !v)}
          className="flex items-center gap-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors">
          <Eye className="w-3 h-3" />
          {showPreview ? 'Hide preview' : 'Show order preview'}
          <ChevronDown className={`w-3 h-3 transition-transform ${showPreview ? 'rotate-180' : ''}`} />
        </button>

        {showPreview && preview && (
          <div className="bg-neutral-950 border border-neutral-800 rounded p-3 space-y-2 text-xs">
            <div className="text-[9px] text-neutral-500 tracking-widest mb-2">ORDER PREVIEW</div>
            {[
              ['Est. Cost',     `$${preview.estCost.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'text-white'],
              ['Pot. Profit',   `+$${preview.potentialProfit.toFixed(2)}`,  'text-green-400'],
              ['Pot. Loss',     `$${preview.potentialLoss.toFixed(2)}`,     'text-red-400'],
            ].map(([k, v, c]) => (
              <div key={k} className="flex justify-between">
                <span className="text-neutral-500">{k}</span>
                <span className={`font-bold ${c}`}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-neutral-800 pt-2">
              <span className="text-neutral-500">Risk/Reward</span>
              <span className={`font-bold ${preview.riskReward >= 2 ? 'text-green-400' : preview.riskReward >= 1 ? 'text-yellow-400' : 'text-red-400'}`}>
                1 : {preview.riskReward.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error   && <div className="text-red-400 text-[10px] font-bold p-2 bg-red-500/10 rounded border border-red-500/20">{error}</div>}
        {success && <div className="text-green-400 text-[10px] font-bold p-2 bg-green-500/10 rounded border border-green-500/20">✓ {success}</div>}

        <div className="mt-auto pt-1">
          <button type="submit" disabled={loading || !qty || qtyN <= 0}
            className={`w-full py-3 rounded text-sm font-bold text-white transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50' : 'hover:brightness-110'} ${side === 'buy' ? 'bg-green-600 shadow-[0_0_12px_rgba(22,163,74,0.2)]' : 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.2)]'}`}>
            <Send className="w-3.5 h-3.5" />
            {loading ? 'Submitting…' : `${ORDER_TYPE_LABELS[orderType]} ${side === 'buy' ? 'Buy' : 'Sell'} ${symbol}`}
          </button>
        </div>
      </form>
    </div>
  );
}
