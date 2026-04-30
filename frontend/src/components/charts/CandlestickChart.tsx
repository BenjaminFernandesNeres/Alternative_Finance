import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries, createSeriesMarkers, IChartApi, ISeriesApi, ISeriesMarkersPluginApi, LineStyle } from 'lightweight-charts';

interface BarData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeMarker {
  time: string;        // ISO or YYYY-MM-DD
  type: 'entry' | 'exit' | 'stop' | 'target';
  price: number;
  label?: string;
  size?: number;
}

interface CandlestickChartProps {
  data: BarData[];
  symbol: string;
  trades?: TradeMarker[];
  levels?: {
    entry?: number;
    target?: number;
    stop?: number;
  };
}

const MARKER_CFG = {
  entry:  { color: '#10b981', shape: 'arrowUp'   as const, position: 'belowBar' as const },
  exit:   { color: '#3b82f6', shape: 'arrowDown'  as const, position: 'aboveBar' as const },
  stop:   { color: '#ef4444', shape: 'arrowDown'  as const, position: 'aboveBar' as const },
  target: { color: '#a78bfa', shape: 'circle'     as const, position: 'aboveBar' as const },
};

function toEpoch(t: string): number {
  return new Date(t).getTime() / 1000;
}

function computeBollinger(data: BarData[], period = 20, stdMult = 2) {
  const rows = data
    .map((d) => ({ time: toEpoch(d.time), close: d.close }))
    .sort((a, b) => a.time - b.time);

  const upper: Array<{ time: any; value: number }> = [];
  const middle: Array<{ time: any; value: number }> = [];
  const lower: Array<{ time: any; value: number }> = [];

  for (let i = period - 1; i < rows.length; i++) {
    const window = rows.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, x) => s + x.close, 0) / period;
    const variance = window.reduce((s, x) => s + (x.close - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    upper.push({ time: rows[i].time as any, value: mean + stdMult * std });
    middle.push({ time: rows[i].time as any, value: mean });
    lower.push({ time: rows[i].time as any, value: mean - stdMult * std });
  }

  return { upper, middle, lower };
}

export default function CandlestickChart({ data, symbol, trades = [], levels }: CandlestickChartProps) {
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartRef        = useRef<IChartApi | null>(null);
  const seriesRef       = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const bbUpperRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMidRef        = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef      = useRef<ISeriesApi<'Line'> | null>(null);
  const markersRef      = useRef<ISeriesMarkersPluginApi<number> | null>(null);
  const priceLinesRef   = useRef<any[]>([]);

  // Create / destroy chart on symbol change
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#a3a3a3',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#404040', labelBackgroundColor: '#27272a' },
        horzLine: { color: '#404040', labelBackgroundColor: '#27272a' },
      },
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: '#262626',
      },
      rightPriceScale: { borderColor: '#262626' },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor:        '#10b981',
      downColor:      '#ef4444',
      borderVisible:  false,
      wickUpColor:    '#10b981',
      wickDownColor:  '#ef4444',
    });

    const bbUpper = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbMid = chart.addSeries(LineSeries, {
      color: '#94a3b8',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbLower = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current  = chart;
    seriesRef.current = series;
    bbUpperRef.current = bbUpper;
    bbMidRef.current = bbMid;
    bbLowerRef.current = bbLower;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      if (seriesRef.current) {
        priceLinesRef.current.forEach((line) => {
          try { seriesRef.current?.removePriceLine(line); } catch {}
        });
      }
      priceLinesRef.current = [];
      markersRef.current = null;
      bbUpperRef.current = null;
      bbMidRef.current = null;
      bbLowerRef.current = null;
      ro.disconnect();
      chart.remove();
    };
  }, [symbol]);

  // Update candle data
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    const formatted = data
      .map(d => ({ time: toEpoch(d.time) as any, open: d.open, high: d.high, low: d.low, close: d.close }))
      .sort((a, b) => a.time - b.time);
    seriesRef.current.setData(formatted);

    const bb = computeBollinger(data, 20, 2);
    bbUpperRef.current?.setData(bb.upper);
    bbMidRef.current?.setData(bb.middle);
    bbLowerRef.current?.setData(bb.lower);

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  // Update trade markers
  useEffect(() => {
    if (!seriesRef.current || data.length === 0) return;
    const markers = trades
      .map(t => {
        const cfg  = MARKER_CFG[t.type];
        const time = toEpoch(t.time) as any;
        return {
          time,
          position:  cfg.position,
          color:     cfg.color,
          shape:     cfg.shape,
          text:      t.label ?? (t.type === 'entry' ? `▶ ENTRY $${t.price.toFixed(2)}` : t.type === 'exit' ? `◼ EXIT $${t.price.toFixed(2)}` : t.type === 'stop' ? `⛔ STOP $${t.price.toFixed(2)}` : `🎯 TARGET $${t.price.toFixed(2)}`),
          size:      t.size ?? (t.type === 'entry' || t.type === 'exit' ? 2 : 1),
        };
      })
      .sort((a, b) => a.time - b.time);
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(seriesRef.current, markers);
    }
  }, [trades, data]);

  // Draw live entry/target/stop horizontal levels at exact prices.
  useEffect(() => {
    if (!seriesRef.current) return;

    priceLinesRef.current.forEach((line) => {
      try { seriesRef.current?.removePriceLine(line); } catch {}
    });
    priceLinesRef.current = [];

    if (!levels) return;

    const maybeCreate = (price: number | undefined, color: string, title: string) => {
      if (!price || Number.isNaN(price) || price <= 0 || !seriesRef.current) return;
      const line = seriesRef.current.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
      priceLinesRef.current.push(line);
    };

    maybeCreate(levels.entry, '#3b82f6', 'ENTRY');
    maybeCreate(levels.target, '#a78bfa', 'TARGET');
    maybeCreate(levels.stop, '#ef4444', 'STOP');
  }, [levels, symbol]);

  return (
    <div className="w-full h-full relative" ref={containerRef}>
      {/* Symbol badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <span className="font-black text-base text-white font-mono bg-black/60 px-2.5 py-1 rounded backdrop-blur-md border border-neutral-800/50">
          {symbol}
        </span>
        {trades.length > 0 && (
          <div className="flex gap-1.5">
            {(['entry','exit','stop','target'] as const).filter(t => trades.some(m => m.type === t)).map(t => (
              <span key={t}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono"
                style={{ color: MARKER_CFG[t].color, borderColor: MARKER_CFG[t].color + '40', background: MARKER_CFG[t].color + '18' }}>
                {t.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded border font-mono"
          style={{ color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b18' }}
        >
          BB(20,2)
        </span>
      </div>
    </div>
  );
}
