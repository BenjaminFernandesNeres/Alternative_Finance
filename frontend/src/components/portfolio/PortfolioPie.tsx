"use client";
import React, { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

const MODEL_ALLOCATION = [
  { name: 'GLD', label: 'Gold', weight: 28, expectedReturn: 12.4, riskScore: 3.2, color: '#f59e0b', rationale: 'Geopolitical tensions driving safe-haven demand. Middle East conflict and USD weakness support allocation.' },
  { name: 'USO', label: 'Crude Oil', weight: 22, expectedReturn: 18.7, riskScore: 6.1, color: '#ef4444', rationale: 'Hormuz shipping disruptions and OPEC+ production cuts support bullish oil thesis.' },
  { name: 'SPY', label: 'S&P 500', weight: 20, expectedReturn: 9.2, riskScore: 4.5, color: '#3b82f6', rationale: 'Defensive core position. Reduces portfolio volatility from commodity concentration.' },
  { name: 'QQQ', label: 'Tech (QQQ)', weight: 15, expectedReturn: 14.1, riskScore: 5.8, color: '#8b5cf6', rationale: 'AI supercycle still intact. Defense tech spending surge benefits sector.' },
  { name: 'UNG', label: 'Nat. Gas', weight: 10, expectedReturn: 22.3, riskScore: 7.9, color: '#06b6d4', rationale: 'European energy demand + Russia sanctions tightening natural gas supply.' },
  { name: 'CASH', label: 'Cash', weight: 5, expectedReturn: 5.1, riskScore: 0.0, color: '#6b7280', rationale: 'Dry powder reserve for tactical reallocation on signal triggers.' },
];

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="white" className="text-sm font-bold" style={{ fontSize: 14, fontWeight: 700 }}>{payload.name}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#a3a3a3" style={{ fontSize: 12 }}>{payload.weight}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 10} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
};

export default function PortfolioPie() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = MODEL_ALLOCATION[activeIdx];

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col h-full font-mono overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white tracking-wider">MODEL ALLOCATION</h3>
        <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">AI RECOMMENDED</span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Donut chart */}
        <div className="flex-1 min-w-0 flex items-center justify-center p-2">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                activeIndex={activeIdx}
                activeShape={renderActiveShape}
                data={MODEL_ALLOCATION}
                cx="50%" cy="50%"
                innerRadius={60} outerRadius={85}
                dataKey="weight"
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onClick={(_, i) => setActiveIdx(i)}
              >
                {MODEL_ALLOCATION.map((e, i) => (
                  <Cell key={e.name} fill={e.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: 6, fontFamily: 'monospace', fontSize: 11 }}
                formatter={(v: any) => [`${v}%`, 'Weight']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detail panel */}
        <div className="w-[200px] shrink-0 border-l border-neutral-800 p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-bold text-sm">{active.label}</span>
            <span className="w-3 h-3 rounded-full" style={{ background: active.color }} />
          </div>
          <div className="space-y-2">
            <div className="bg-neutral-950 rounded p-2">
              <div className="text-[9px] text-neutral-500 mb-0.5">ALLOCATION</div>
              <div className="text-lg font-bold text-white">{active.weight}%</div>
            </div>
            <div className="bg-neutral-950 rounded p-2">
              <div className="text-[9px] text-neutral-500 mb-0.5">EXP. RETURN</div>
              <div className="text-sm font-bold text-green-400">+{active.expectedReturn}%</div>
            </div>
            <div className="bg-neutral-950 rounded p-2">
              <div className="text-[9px] text-neutral-500 mb-0.5">RISK SCORE</div>
              <div className="text-sm font-bold text-orange-400">{active.riskScore}/10</div>
            </div>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed border-t border-neutral-800 pt-2 mt-1">{active.rationale}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-1 shrink-0 border-t border-neutral-800 pt-2">
        {MODEL_ALLOCATION.map((a, i) => (
          <button
            key={a.name}
            onClick={() => setActiveIdx(i)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${activeIdx === i ? 'bg-neutral-700' : 'hover:bg-neutral-800'}`}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
            <span className="text-neutral-300 truncate">{a.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
