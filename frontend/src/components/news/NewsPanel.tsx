import React, { useEffect, useState } from 'react';
import { Newspaper, Rss, AlertTriangle, TrendingUp, Globe2, ChevronRight, ArrowLeft } from 'lucide-react';
import { apiUrl } from '@/lib/api';

type NewsItem = {
  id: string;
  source: string;
  time: string;
  severity: 'high' | 'medium' | 'low';
  tags: string[];
  title: string;
  sentiment: number;
  relatedTickers: string[];
  geoImpact: string;
  fullText: string;
  sourceUrl?: string;
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'from-red-500/60 to-red-500/10',
  medium: 'from-orange-500/60 to-orange-500/10',
  low: 'from-blue-500/60 to-blue-500/10',
};

const SENTIMENT_COLOR = (s: number) =>
  s < -0.6 ? '#ef4444' : s < -0.3 ? '#f59e0b' : s > 0.3 ? '#10b981' : '#6b7280';

export default function NewsPanel() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJsonWithTimeout = async (url: string, timeoutMs = 9000) => {
    const ctrl = new AbortController();
    const id = window.setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
      return res;
    } finally {
      window.clearTimeout(id);
    }
  };

  const mapGeoIntConflictsToNews = (payload: unknown): NewsItem[] => {
    const conflicts = Array.isArray((payload as { conflicts?: unknown[] })?.conflicts)
      ? ((payload as { conflicts?: unknown[] }).conflicts as Array<Record<string, unknown>>)
      : [];

    return conflicts.slice(0, 25).map((c, idx) => ({
      id: String(c.id ?? `geoint_${idx}`),
      source: 'GDELT GeoINT',
      time: String(c.time ?? 'recent'),
      severity: String(c.severity ?? '').toLowerCase().includes('critical')
        ? 'high'
        : String(c.severity ?? '').toLowerCase().includes('high')
          ? 'medium'
          : 'low',
      tags: ['LIVE', 'GEOINT'],
      title: String(c.title ?? 'Live conflict event'),
      sentiment: -0.55,
      relatedTickers: ['GLD', 'USO', 'UNG'],
      geoImpact: 'Global',
      fullText: String(c.details ?? c.title ?? 'Live GeoINT conflict event'),
      sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : undefined,
    }));
  };

  useEffect(() => {
    let canceled = false;

    const loadNews = async () => {
      try {
        const res = await fetchJsonWithTimeout(apiUrl('/news/live?limit=25'));
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];

        if (!canceled) {
          setNews(items);
          setError(null);
        }
      } catch (e) {
        try {
          const fallbackRes = await fetchJsonWithTimeout(apiUrl('/geoint/live-map?conflict_limit=25&missile_limit=10&flight_limit=10&vessel_limit=10'));
          if (!fallbackRes.ok) throw new Error(`Fallback HTTP ${fallbackRes.status}`);
          const fallbackPayload = await fallbackRes.json();
          const mapped = mapGeoIntConflictsToNews(fallbackPayload);
          if (!canceled) {
            setNews(mapped);
            setError(mapped.length > 0 ? null : 'Live news feed is slow and fallback returned no items.');
          }
        } catch {
          if (!canceled) {
            setError(e instanceof Error ? e.message : 'Failed to load live news');
            setNews([]);
          }
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    };

    loadNews();
    const timer = window.setInterval(loadNews, 60_000);

    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, []);

  const selected = news.find(n => n.id === selectedId);

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden relative font-mono">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          {selected ? (
            <button
              onClick={() => setSelectedId(null)}
              className="flex items-center gap-1 text-neutral-400 hover:text-neutral-100 transition-colors text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              BACK
            </button>
          ) : (
            <>
              <Newspaper className="w-4 h-4 text-neutral-400" />
              <h2 className="text-sm font-bold text-neutral-200 tracking-wider">GLOBAL FEED</h2>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-green-500/80 font-mono bg-green-500/10 px-2 py-0.5 rounded-sm border border-green-500/20">
          <Rss className="w-3 h-3" />
          <span>LIVE</span>
        </div>
      </div>

      {/* Feed List */}
      {!selected && (
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
          {loading && (
            <div className="px-3 py-4 text-xs text-neutral-500">Loading live news...</div>
          )}

          {!loading && error && (
            <div className="px-3 py-4 text-xs text-red-400">Live news unavailable: {error}</div>
          )}

          {!loading && !error && news.length === 0 && (
            <div className="px-3 py-4 text-xs text-neutral-500">No live articles available right now.</div>
          )}

          {news.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className="p-3 border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors group cursor-pointer flex flex-col gap-2 relative"
            >
              {/* Severity indicator */}
              <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${SEVERITY_COLORS[item.severity]}`} />

              <div className="flex justify-between items-start">
                <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{item.source}</span>
                <span className="text-[10px] text-neutral-500">{item.time}</span>
              </div>

              <p className="text-xs text-neutral-200 leading-snug">{item.title}</p>

              <div className="flex items-center justify-between mt-0.5">
                <div className="flex gap-1 flex-wrap">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: SENTIMENT_COLOR(item.sentiment) }}
                  >
                    {item.sentiment > 0 ? '+' : ''}{(item.sentiment * 100).toFixed(0)}%
                  </span>
                  <ChevronRight className="w-3 h-3 text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-4">
          {/* Source + Time */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-400 font-bold tracking-widest uppercase">{selected.source}</span>
            <span className="text-neutral-500">{selected.time}</span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-bold text-white leading-snug">{selected.title}</h3>

          {selected.sourceUrl && (
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open source article
            </a>
          )}

          {/* Tags row */}
          <div className="flex gap-1.5 flex-wrap">
            {selected.tags.map(t => (
              <span key={t} className="text-[9px] px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">{t}</span>
            ))}
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-neutral-950 border border-neutral-800 rounded p-2">
              <div className="text-neutral-500 mb-0.5">SENTIMENT</div>
              <div className="font-bold" style={{ color: SENTIMENT_COLOR(selected.sentiment) }}>
                {selected.sentiment > 0 ? 'POSITIVE' : selected.sentiment < -0.6 ? 'VERY NEGATIVE' : 'NEGATIVE'}
                <span className="ml-1 text-neutral-500">({(selected.sentiment * 100).toFixed(0)}%)</span>
              </div>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 rounded p-2">
              <div className="text-neutral-500 mb-0.5">GEO IMPACT</div>
              <div className="text-neutral-200 font-bold flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-blue-400" />
                {selected.geoImpact}
              </div>
            </div>
          </div>

          {/* Full article */}
          <div>
            <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">FULL REPORT</div>
            <div className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">{selected.fullText}</div>
          </div>

          {/* Related tickers */}
          <div>
            <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">RELATED ASSETS</div>
            <div className="flex gap-2 flex-wrap">
              {selected.relatedTickers.map(ticker => (
                <span
                  key={ticker}
                  className="flex items-center gap-1 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs text-neutral-200 font-bold hover:border-blue-500/50 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-3 h-3" />
                  {ticker}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t border-neutral-800 shrink-0 flex justify-between items-center text-[10px] text-neutral-500">
        <span>{news.length.toLocaleString()} live items</span>
        <span className="flex items-center gap-1 text-orange-400/80">
          <AlertTriangle className="w-3 h-3" /> HIGH VOLATILITY
        </span>
      </div>
    </div>
  );
}
