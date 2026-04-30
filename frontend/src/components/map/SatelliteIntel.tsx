"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Satellite, AlertTriangle, Shield, ZoomIn } from 'lucide-react';
import { geointMapUrl } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

type Detection = {
  label: string;
  confidence: number;
  // percentage of image container (0–100)
  x: number; y: number; w: number; h: number;
  color: string;
};

type ConflictView = {
  id: string;
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  classification: string;
  satLat: string;  // display string
  satLon: string;
  altitude: string;
  detections: Detection[];
  features: { label: string; value: number; color: string }[];
};

type LiveConflict = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  time: string;
  details: string;
  countryTags?: string[];
  sourceCount?: number;
};

// ── GEOINT Data per conflict event ───────────────────────────────────────────

const FALLBACK_VIEWS: ConflictView[] = [];

const DETECTION_TEMPLATES = [
  { label: 'HEAT_SIGNATURE', color: '#f97316' },
  { label: 'IMPACT_CRATER', color: '#ef4444' },
  { label: 'STRUCT_COLLAPSE', color: '#ef4444' },
  { label: 'FORCE_MOVEMENT', color: '#f97316' },
  { label: 'NEW_ASSET', color: '#3b82f6' },
  { label: 'RADAR_EMITTER', color: '#eab308' },
  { label: 'DRONE_SWARM', color: '#ef4444' },
  { label: 'NAVAL_ASSET', color: '#ef4444' },
  { label: 'CHOKEPOINT_BLOCK', color: '#f97316' },
];

function strSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function rng(seed: number): () => number {
  let t = seed || 1;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function toLatLabel(lat: number): string {
  const hemi = lat >= 0 ? 'N' : 'S';
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${String(deg).padStart(2, '0')}°${min.toFixed(2).padStart(5, '0')}${hemi}`;
}

function toLngLabel(lng: number): string {
  const hemi = lng >= 0 ? 'E' : 'W';
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${String(deg).padStart(3, '0')}°${min.toFixed(2).padStart(5, '0')}${hemi}`;
}

function toSeverity(v: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' {
  if (v === 'CRITICAL') return 'CRITICAL';
  if (v === 'HIGH') return 'HIGH';
  return 'MEDIUM';
}

function buildDetections(ev: LiveConflict): Detection[] {
  const seededRand = rng(strSeed(`${ev.id}:${ev.title}:${ev.time}`));
  const count = 4;
  const out: Detection[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i += 1) {
    let idx = Math.floor(seededRand() * DETECTION_TEMPLATES.length);
    while (used.has(idx)) {
      idx = (idx + 1) % DETECTION_TEMPLATES.length;
    }
    used.add(idx);
    const t = DETECTION_TEMPLATES[idx];
    out.push({
      label: t.label,
      confidence: Number((0.72 + seededRand() * 0.27).toFixed(2)),
      x: Number((12 + seededRand() * 62).toFixed(1)),
      y: Number((16 + seededRand() * 52).toFixed(1)),
      w: Number((14 + seededRand() * 14).toFixed(1)),
      h: Number((10 + seededRand() * 10).toFixed(1)),
      color: t.color,
    });
  }

  return out;
}

function buildFeatures(ev: LiveConflict): { label: string; value: number; color: string }[] {
  const base = ev.severity === 'CRITICAL' ? 86 : ev.severity === 'HIGH' ? 73 : 58;
  const seededRand = rng(strSeed(`${ev.id}:${ev.details}`));
  const labels = [
    ['Conflict Zone Score', '#ef4444'],
    ['Energy Disruption Index', '#f97316'],
    ['Supply Risk Index', '#f59e0b'],
    ['Escalation Probability', '#ef4444'],
    ['Air Defense Degradation', '#eab308'],
    ['Shipping Lane Threat', '#f97316'],
  ] as const;

  return labels.map(([label, color], idx) => ({
    label,
    color,
    value: Math.max(35, Math.min(99, Math.round(base + (idx - 2) * 2 + seededRand() * 13 - 6))),
  }));
}

function classificationFor(type: string): string {
  if (type.includes('infrastructure')) return 'VIIRS INFRA-FUSION';
  if (type.includes('military')) return 'SAR COHERENCE';
  if (type.includes('armed')) return 'THERMAL SIGINT';
  return 'MULTI-SPECTRAL FUSION';
}

function subtitleFor(type: string): string {
  if (type.includes('infrastructure')) return 'Infra Watch · Critical Asset Monitoring';
  if (type.includes('military')) return 'Naval/Air Activity · Force Posture';
  if (type.includes('armed')) return 'Conflict Contact · Tactical Activity';
  return 'GeoINT Feed · Operational Assessment';
}

function toConflictViews(conflicts: LiveConflict[]): ConflictView[] {
  return conflicts.map((ev) => ({
    id: ev.id,
    title: ev.title,
    subtitle: subtitleFor(ev.type),
    lat: ev.lat,
    lng: ev.lng,
    severity: toSeverity(ev.severity),
    classification: classificationFor(ev.type),
    satLat: toLatLabel(ev.lat),
    satLon: toLngLabel(ev.lng),
    altitude: `${490 + (strSeed(ev.id) % 15)} KM`,
    detections: buildDetections(ev),
    features: buildFeatures(ev),
  }));
}

// ── Esri World Imagery REST export — publicly accessible, CORS-enabled ───────
// bbox order: minLon,minLat,maxLon,maxLat (EPSG:4326 / WGS84)
function buildCropUrl(lat: number, lng: number, deg = 2.2): string {
  const minLon = (lng - deg).toFixed(4);
  const minLat = (lat - deg).toFixed(4);
  const maxLon = (lng + deg).toFixed(4);
  const maxLat = (lat + deg).toFixed(4);
  return (
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export` +
    `?bbox=${minLon},${minLat},${maxLon},${maxLat}` +
    `&bboxSR=4326&imageSR=4326&size=512,512&format=jpg&f=image`
  );
}

// ── Severity badge ────────────────────────────────────────────────────────────

const SEV = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SatelliteIntel() {
  const [intelViews, setIntelViews] = useState<ConflictView[]>(FALLBACK_VIEWS);
  const [idx,        setIdx]        = useState(0);
  const [imgLoaded,  setImgLoaded]  = useState(false);
  const [imgSrc,     setImgSrc]     = useState('');
  const [scanLine,   setScanLine]   = useState(0);
  const [pulse,      setPulse]      = useState(false);
  const [liveError,  setLiveError]  = useState<string | null>(null);
  const scanRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const view = intelViews[idx] ?? null;

  // Pull live conflict feed and map it into satellite intel views.
  useEffect(() => {
    let active = true;

    const loadIntelViews = async () => {
      try {
        const resp = await fetch(
          geointMapUrl(8, 8, 10, 8),
          { cache: 'no-store' }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const payload = (await resp.json()) as { conflicts?: LiveConflict[] };
        const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
        const mapped = toConflictViews(conflicts).filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng));

        if (active && mapped.length > 0) {
          setIntelViews(mapped);
          setIdx((curr) => (curr >= mapped.length ? 0 : curr));
          setLiveError(null);
        } else if (active) {
          setIntelViews([]);
          setLiveError('No live GeoINT conflicts available.');
        }
      } catch {
        if (active) {
          setIntelViews([]);
          setLiveError('Live GeoINT feed unavailable.');
        }
      }
    };

    loadIntelViews();
    const id = setInterval(loadIntelViews, 75_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // Build + set image src immediately on view change (no pre-loader — avoids CORS issues)
  useEffect(() => {
    if (!view) {
      setImgLoaded(false);
      setPulse(false);
      setImgSrc('');
      return;
    }
    setImgLoaded(false);
    setPulse(false);
    const url = buildCropUrl(view.lat, view.lng);
    setImgSrc(url);
  }, [view]);

  // Scanning line animation
  useEffect(() => {
    scanRef.current = setInterval(() => {
      setScanLine(v => (v >= 100 ? 0 : v + 1));
    }, 30);
    return () => { if (scanRef.current) clearInterval(scanRef.current); };
  }, []);

  const prev = () => setIdx((i) => {
    if (intelViews.length === 0) return 0;
    return i === 0 ? intelViews.length - 1 : i - 1;
  });
  const next = () => setIdx((i) => {
    if (intelViews.length === 0) return 0;
    return i === intelViews.length - 1 ? 0 : i + 1;
  });

  return (
    <div className="h-full bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col font-mono text-xs overflow-hidden">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-3 py-2.5 border-b border-neutral-800 shrink-0 bg-neutral-950/60">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Satellite className="w-3.5 h-3.5 text-sky-500" />
            <span className="text-[10px] font-black tracking-[0.12em] text-neutral-200 uppercase">
              GEOINT · SAT INTEL
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${SEV[view?.severity ?? 'MEDIUM']}`}>
              {view?.severity ?? 'NO DATA'}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-sky-500/10 text-sky-400 border-sky-500/30">
              {view?.classification ?? 'LIVE FEED'}
            </span>
          </div>
        </div>

        {/* Event selector */}
        <div className="flex items-center gap-1.5">
          <button onClick={prev} className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 transition-colors">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-bold text-neutral-100 truncate leading-tight">{view?.title ?? 'Waiting for live GeoINT events...'}</div>
            <div className="text-[9px] text-neutral-500 truncate mt-0.5">{view?.subtitle ?? (liveError ?? 'Polling /geoint/live-map')}</div>
          </div>
          <button onClick={next} className="p-0.5 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-200 transition-colors">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Event dots */}
        <div className="flex justify-center gap-1 mt-1.5">
          {intelViews.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-sky-400' : 'bg-neutral-700'}`} />
          ))}
        </div>
      </div>

      {/* ── Satellite Image Window ─────────────────────────── */}
      <div className="relative shrink-0 bg-black overflow-hidden" style={{ height: 200 }}>

        {!view && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950">
            <div className="w-6 h-6 border-2 border-sky-500/40 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-[9px] text-sky-600 tracking-widest">WAITING FOR LIVE EVENTS…</span>
          </div>
        )}

        {/* Loading state */}
        {view && !imgLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950">
            <div className="w-6 h-6 border-2 border-sky-500/40 border-t-sky-500 rounded-full animate-spin" />
            <span className="text-[9px] text-sky-600 tracking-widest">ACQUIRING SIGNAL…</span>
          </div>
        )}

        {/* Satellite image */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt="satellite"
            className={`w-full h-full object-cover transition-opacity duration-700 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            style={{ filter: 'saturate(0.8) brightness(0.85) contrast(1.1)' }}
            onLoad={() => { setImgLoaded(true); setPulse(true); }}
            onError={() => setImgLoaded(true)}
          />
        )}

        {/* CRT scan line */}
        <div
          className="absolute left-0 right-0 h-px bg-sky-400/20 pointer-events-none transition-none"
          style={{ top: `${scanLine}%` }}
        />

        {/* Corner brackets */}
        {[
          'top-1.5 left-1.5 border-t-2 border-l-2',
          'top-1.5 right-1.5 border-t-2 border-r-2',
          'bottom-1.5 left-1.5 border-b-2 border-l-2',
          'bottom-1.5 right-1.5 border-b-2 border-r-2',
        ].map((cls, i) => (
          <div key={i} className={`absolute w-4 h-4 border-sky-500/60 pointer-events-none ${cls}`} />
        ))}

        {/* Crosshair center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-4 h-4">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-sky-500/30" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-sky-500/30" />
          </div>
        </div>

        {/* Detection boxes */}
        {imgLoaded && view?.detections.map((det, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left:   `${det.x}%`,
              top:    `${det.y}%`,
              width:  `${det.w}%`,
              height: `${det.h}%`,
              border: `1px dashed ${det.color}`,
              boxShadow: `0 0 8px ${det.color}33`,
            }}
          >
            {/* Label chip */}
            <div
              className="absolute -top-4 left-0 text-[8px] font-bold px-1 py-0.5 whitespace-nowrap"
              style={{ background: `${det.color}22`, color: det.color, border: `1px solid ${det.color}66` }}
            >
              {det.label} <span style={{ opacity: 0.7 }}>{(det.confidence * 100).toFixed(0)}%</span>
            </div>
            {/* Corner dot */}
            <div className="absolute top-0 left-0 w-1 h-1 rounded-full" style={{ background: det.color }} />
          </div>
        ))}

        {/* Top-right classification overlay */}
        <div className="absolute top-1.5 right-6 text-[8px] font-bold text-sky-400/70 tracking-widest pointer-events-none">
          {imgLoaded && pulse && <span className="animate-pulse">● REC</span>}
        </div>

        {/* Coordinates bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm px-2 py-1 flex justify-between items-center pointer-events-none">
          <span className="text-[8px] text-sky-400/80 tracking-wider">
            LAT {view?.satLat ?? '---'} | LON {view?.satLon ?? '---'}
          </span>
          <span className="text-[8px] text-sky-400/50">ALT {view?.altitude ?? '---'}</span>
        </div>
      </div>

      {/* ── Raw Feature Inputs ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-1.5">
        <div className="text-[9px] font-black tracking-[0.15em] text-neutral-500 uppercase mb-2 flex items-center gap-2">
          <Shield className="w-2.5 h-2.5" />
          Raw Feature Inputs
        </div>

        {(view?.features ?? []).map((f) => (
          <div key={f.label}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-[9px] text-neutral-400">{f.label}</span>
              <span className="text-[9px] font-bold" style={{ color: f.color }}>{f.value}</span>
            </div>
            <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${f.value}%`, background: f.color, opacity: 0.85 }}
              />
            </div>
          </div>
        ))}

        {/* Aggregate threat score */}
        <div className="mt-3 pt-2 border-t border-neutral-800">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] text-neutral-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 text-yellow-500" />
              Aggregate Threat
            </span>
            <span className="text-[10px] font-black text-white">
              {view?.features?.length
                ? Math.round(view.features.reduce((s, f) => s + f.value, 0) / view.features.length)
                : 0}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${view?.features?.length
                  ? Math.round(view.features.reduce((s, f) => s + f.value, 0) / view.features.length)
                  : 0}%`,
                background: 'linear-gradient(90deg, #f97316, #ef4444)',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="px-3 py-1.5 border-t border-neutral-800 shrink-0 flex justify-between items-center">
        <span className="text-[8px] text-green-600">● ESRI SAT LIVE</span>
        <span className="text-[8px] text-neutral-600">{intelViews.length > 0 ? `${idx + 1}/${intelViews.length} · ${(view?.id ?? 'NA').toUpperCase()}` : '0/0 · LIVE PENDING'}</span>
        <button className="flex items-center gap-1 text-[8px] text-neutral-500 hover:text-neutral-300 transition-colors">
          <ZoomIn className="w-2.5 h-2.5" /> FULL RES
        </button>
      </div>
    </div>
  );
}
