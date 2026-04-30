"use client";
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { apiUrl } from '../../lib/api';

type Tab = 'open' | 'filled' | 'cancelled';

const STATUS_CFG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  new:              { color:'text-blue-400',    bg:'bg-blue-500/10 border-blue-500/20',     icon: Clock },
  accepted:         { color:'text-blue-300',    bg:'bg-blue-500/8 border-blue-500/15',      icon: Clock },
  pending_new:      { color:'text-yellow-400',  bg:'bg-yellow-500/10 border-yellow-500/20', icon: Clock },
  partially_filled: { color:'text-orange-400',  bg:'bg-orange-500/10 border-orange-500/20', icon: AlertCircle },
  filled:           { color:'text-green-400',   bg:'bg-green-500/10 border-green-500/20',   icon: CheckCircle },
  done_for_day:     { color:'text-neutral-400', bg:'bg-neutral-800 border-neutral-700',     icon: CheckCircle },
  canceled:         { color:'text-neutral-500', bg:'bg-neutral-800/50 border-neutral-700',  icon: XCircle },
  cancelled:        { color:'text-neutral-500', bg:'bg-neutral-800/50 border-neutral-700',  icon: XCircle },
  expired:          { color:'text-neutral-500', bg:'bg-neutral-800/50 border-neutral-700',  icon: XCircle },
  rejected:         { color:'text-red-400',     bg:'bg-red-500/10 border-red-500/20',       icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg  = STATUS_CFG[status] ?? STATUS_CFG['new'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {status.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

function fmtDt(ts?: string) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const COL_GRID = '72px 64px 48px 52px 52px 68px 1fr 60px 32px';

function OrderRow({ o, onCancel }: { o: any; onCancel?: (id: string) => void }) {
  const isOpen     = ['new','accepted','pending_new','partially_filled'].includes(o.status);
  const isRejected = o.status === 'rejected';
  return (
    <div
      className={`grid items-center px-3 py-2 border-b hover:bg-neutral-800/20 transition-colors text-[11px] group ${
        isRejected
          ? 'border-red-900/40 bg-red-950/20'
          : 'border-neutral-800/40'
      }`}
      style={{ gridTemplateColumns: COL_GRID }}
    >
      <span className="font-black text-white">{o.symbol}</span>
      <span className="text-neutral-400 capitalize text-[10px]">{(o.order_type || o.type || 'market').replace('_', '-')}</span>
      <span className={`font-bold uppercase ${o.side === 'buy' ? 'text-green-400' : 'text-red-400'}`}>{String(o.side || '').replace(/OrderSide\./i, '')}</span>
      <span className="text-neutral-300 font-mono">{o.qty}</span>
      <span className={`font-mono ${Number(o.filled_qty) > 0 ? 'text-green-400' : 'text-neutral-500'}`}>{o.filled_qty ?? 0}</span>
      <span className="text-neutral-300 font-mono text-[11px]">
        {o.filled_avg_price ? `$${parseFloat(o.filled_avg_price).toFixed(2)}`
         : o.limit_price    ? `$${parseFloat(o.limit_price).toFixed(2)}`
         : '—'}
      </span>
      <div><StatusBadge status={o.status} /></div>
      <span className="text-neutral-600 text-[9px]">{fmtDt(o.submitted_at || o.created_at)}</span>
      <span className="text-right pr-1">
        {isOpen && onCancel && (
          <button
            onClick={() => onCancel(o.id)}
            className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-400 transition-all"
            title="Cancel order"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    </div>
  );
}

export default function OrdersList() {
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [tab,       setTab]       = useState<Tab>('open');

  const fetchOrders = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(apiUrl('/trading/orders?status=open')),
        fetch(apiUrl('/trading/orders?status=closed')),
      ]);
      const combined: any[] = [];
      if (r1.ok) combined.push(...await r1.json());
      if (r2.ok) combined.push(...await r2.json());
      setAllOrders(combined);
    } catch {}
  }, []);

  useEffect(() => {
    fetchOrders();
    const iv = setInterval(fetchOrders, 3000);
    return () => clearInterval(iv);
  }, [fetchOrders]);

  const cancelOrder = async (id: string) => {
    try {
      await fetch(apiUrl(`/trading/orders/${id}`), { method: 'DELETE' });
      fetchOrders();
    } catch {}
  };

  const openSet      = new Set(['new','accepted','pending_new','partially_filled']);
  const filledSet    = new Set(['filled','done_for_day']);
  const cancelledSet = new Set(['canceled','cancelled','expired']);
  const rejectedSet  = new Set(['rejected']);

  // Rejected orders float to the top within the cancelled tab
  const cancelledOrders = [
    ...allOrders.filter(o => rejectedSet.has(o.status)),
    ...allOrders.filter(o => cancelledSet.has(o.status)),
  ];
  const rejectedCount = allOrders.filter(o => rejectedSet.has(o.status)).length;

  const tabs: Record<Tab, any[]> = {
    open:      allOrders.filter(o => openSet.has(o.status)),
    filled:    allOrders.filter(o => filledSet.has(o.status)),
    cancelled: cancelledOrders,
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center border-b border-neutral-800 shrink-0">
        {(['open','filled','cancelled'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${tab === t ? 'text-white border-blue-500' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
            {t.toUpperCase()}
            {tabs[t].length > 0 && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tab === t
                ? t === 'open' ? 'bg-blue-500/20 text-blue-400' : t === 'filled' ? 'bg-green-500/20 text-green-400' : 'bg-neutral-600 text-neutral-400'
                : 'bg-neutral-800 text-neutral-500'}`}>
                {tabs[t].length}
              </span>
            )}
            {/* Red badge on cancelled tab when there are rejections */}
            {t === 'cancelled' && rejectedCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-red-500/20 text-red-400">
                {rejectedCount} rejected
              </span>
            )}
          </button>
        ))}
        <button onClick={fetchOrders} className="ml-auto mr-3 text-neutral-600 hover:text-neutral-300 transition-colors" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Rejected alert banner */}
      {tab === 'cancelled' && rejectedCount > 0 && (
        <div className="px-3 py-2 bg-red-950/40 border-b border-red-900/40 flex items-center gap-2 text-[10px] text-red-400 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <span className="font-bold">{rejectedCount} order{rejectedCount > 1 ? 's' : ''} rejected</span> — check buying power, PDT rules, or market hours.
          </span>
        </div>
      )}

      {/* Column headers */}
      <div className="grid px-3 py-1.5 border-b border-neutral-800/60 text-[9px] text-neutral-600 font-bold tracking-widest shrink-0"
        style={{ gridTemplateColumns: COL_GRID }}>
        <span>SYMBOL</span><span>TYPE</span><span>SIDE</span><span>QTY</span>
        <span>FILLED</span><span>PRICE</span><span>STATUS</span><span>TIME</span><span></span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tabs[tab].length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-600 text-xs">No {tab} orders</div>
        ) : (
          tabs[tab].map(o => <OrderRow key={o.id} o={o} onCancel={tab === 'open' ? cancelOrder : undefined} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-neutral-800 shrink-0 flex gap-4 text-[10px] text-neutral-600">
        <span>Open: <span className="text-blue-400 font-bold">{tabs.open.length}</span></span>
        <span>Filled: <span className="text-green-400 font-bold">{tabs.filled.length}</span></span>
        <span>Cancelled: <span className="text-neutral-400 font-bold">{tabs.cancelled.length}</span></span>
        {rejectedCount > 0 && (
          <span>Rejected: <span className="text-red-400 font-bold">{rejectedCount}</span></span>
        )}
        <span className="ml-auto">Refresh 3s</span>
      </div>
    </div>
  );
}
