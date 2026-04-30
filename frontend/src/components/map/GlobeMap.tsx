"use client";

import React, { useState, useEffect, useRef } from 'react';
import Globe from 'react-globe.gl';
import { ShieldAlert, Ship, Plane, Crosshair, Waves, X, Satellite, Cloud } from 'lucide-react';
import { geointMapUrl } from '@/lib/api';

// Returns a date string YYYY-MM-DD that is guaranteed to have NASA GIBS imagery
// MODIS Terra has ~24-48h processing lag so we use 2 days ago
function getSatelliteDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  return d.toISOString().split('T')[0];
}

// NASA GIBS WorldView snapshot – equirectangular projection, live daily MODIS composite
function buildSatelliteUrl(date: string): string {
  return (
    `https://wvs.earthdata.nasa.gov/api/v1/snapshot` +
    `?REQUEST=GetSnapshot&TIME=${date}` +
    `&BBOX=-90,-180,90,180&CRS=EPSG:4326` +
    `&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor,VIIRS_SNPP_CorrectedReflectance_TrueColor` +
    `&WRAP=x&FORMAT=image%2Fjpeg&WIDTH=4096&HEIGHT=2048`
  );
}

type ConflictEvent = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  type: string;
  countryTags: string[];
  sourceCount: number;
  time: string;
  color: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  marketImpact: string;
  details: string;
};

type MapArc = {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string] | string[];
  layer: 'missiles' | 'flights';
};

type VesselPoint = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  type: string;
  flag: string;
  heading: number | null;
  speed: number | null;
  color: string;
  details: string;
};

type SceneLike = {
  add: (obj: MeshLike) => void;
  remove: (obj: MeshLike) => void;
};

type MeshLike = {
  rotation: { y: number };
  geometry?: { dispose?: () => void };
  material?: { dispose?: () => void };
};

type GlobeHandle = {
  pointOfView: (view: { lat: number; lng: number; altitude: number }, ms?: number) => void;
  scene?: () => SceneLike;
};

type LiveMapPayload = {
  stale?: boolean;
  conflicts?: ConflictEvent[];
  missiles?: MapArc[];
  flights?: MapArc[];
  vessels?: VesselPoint[];
};

const LAYER_CONFIG = [
  { key: 'conflicts', label: 'Events',   icon: Waves,    color: '#ef4444' },
  { key: 'missiles',  label: 'Missiles', icon: Crosshair,color: '#f97316' },
  { key: 'vessels',   label: 'Vessels',  icon: Ship,     color: '#3b82f6' },
  { key: 'flights',   label: 'Flights',  icon: Plane,    color: '#60a5fa' },
];

export default function GlobeMap() {
  const globeEl     = useRef<GlobeHandle | null>(null);
  const containerRef= useRef<HTMLDivElement>(null);
  const [dimensions,    setDimensions]    = useState({ width: 0, height: 0 });
  const [warMode,       setWarMode]       = useState(false);
  const [satellite,     setSatellite]     = useState(false);
  const [clouds,        setClouds]        = useState(false);
  const [satDate,       setSatDate]       = useState('');
  const [satUrl,        setSatUrl]        = useState('');
  const [satReady,      setSatReady]      = useState(false);
  const [layers,        setLayers]        = useState({ conflicts: true, missiles: true, vessels: true, flights: false });
  const [selected,      setSelected]      = useState<ConflictEvent | VesselPoint | null>(null);
  const [selType,       setSelType]       = useState<'conflict' | 'vessel' | ''>('');
  const [globeReady,    setGlobeReady]    = useState(false);
  const [conflictEvents, setConflictEvents] = useState<ConflictEvent[]>([]);
  const [missileArcs, setMissileArcs] = useState<MapArc[]>([]);
  const [flightArcs, setFlightArcs] = useState<MapArc[]>([]);
  const [vessels, setVessels] = useState<VesselPoint[]>([]);
  const [feedStale, setFeedStale] = useState(false);
  const cloudsMeshRef = useRef<MeshLike | null>(null);

  const formatMetric = (value: number | null | undefined, unit = '') =>
    typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}${unit}` : 'N/A';

  const formatCoord = (value: number | null | undefined, axis: 'lat' | 'lng') => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'N/A';
    const suffix = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(2)}°${suffix}`;
  };

  // Resize observer
  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Initial camera
  useEffect(() => {
    if (globeEl.current)
      globeEl.current.pointOfView({ lat: 25, lng: 45, altitude: 2.2 }, 0);
  }, []);

  // Build satellite URL on mount and refresh daily
  useEffect(() => {
    const init = () => {
      const date = getSatelliteDate();
      setSatDate(date);
      setSatUrl(buildSatelliteUrl(date));
      setSatReady(false);
      // Pre-load the image so we know if it's available
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => setSatReady(true);
      img.onerror = () => {
        // Try one day earlier as fallback
        const d = new Date(date);
        d.setDate(d.getDate() - 1);
        const fallback = d.toISOString().split('T')[0];
        setSatDate(fallback);
        setSatUrl(buildSatelliteUrl(fallback));
        setSatReady(true); // show anyway
      };
      img.src = buildSatelliteUrl(date);
    };
    init();
    // Refresh every 6 hours
    const id = setInterval(init, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Live GeoINT feed (conflicts, missiles, flights, vessels)
  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const resp = await fetch(geointMapUrl(24, 30, 80, 28), { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const payload = (await resp.json()) as LiveMapPayload;
        if (!alive) return;

        setConflictEvents(Array.isArray(payload.conflicts) ? payload.conflicts : []);
        setMissileArcs(Array.isArray(payload.missiles) ? payload.missiles : []);
        setFlightArcs(Array.isArray(payload.flights) ? payload.flights : []);
        setVessels(Array.isArray(payload.vessels) ? payload.vessels : []);
        setFeedStale(Boolean(payload.stale));
      } catch {
        if (!alive) return;
        setFeedStale(true);
      }
    };

    load();
    const id = setInterval(load, 75_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Derive the globe texture URL
  const globeImageUrl = satellite && satReady
    ? satUrl
    : warMode
      ? '//unpkg.com/three-globe/example/img/earth-night.jpg'
      : '//unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

  // Cloud sphere — added/removed from Three.js scene whenever `clouds` or `globeReady` changes
  useEffect(() => {
    if (!globeReady || !globeEl.current) return;
    const scene = globeEl.current.scene?.();
    if (!scene) return;

    // Remove existing cloud mesh first
    if (cloudsMeshRef.current) {
      scene.remove(cloudsMeshRef.current);
      cloudsMeshRef.current.geometry?.dispose();
      cloudsMeshRef.current.material?.dispose();
      cloudsMeshRef.current = null;
    }

    if (!clouds) return;

    import('three').then((THREE) => {
      const geometry = new THREE.SphereGeometry(101, 64, 64);
      const loader   = new THREE.TextureLoader();
      loader.load(
        '//unpkg.com/three-globe/example/img/earth-clouds.png',
        (texture) => {
          const material = new THREE.MeshPhongMaterial({
            map: texture, transparent: true, opacity: 0.65, depthWrite: false,
          });
          const mesh = new THREE.Mesh(geometry, material);
          scene.add(mesh);
          cloudsMeshRef.current = mesh;
          // Slowly rotate the cloud layer
          const animate = () => {
            if (cloudsMeshRef.current) {
              cloudsMeshRef.current.rotation.y += 0.0003;
              requestAnimationFrame(animate);
            }
          };
          animate();
        }
      );
    });
  }, [clouds, globeReady]);

  const toggleLayer = (key: string) =>
    setLayers(l => ({ ...l, [key]: !l[key as keyof typeof l] }));

  // Merged arcs: missiles + flights, filtered by active layers
  const activeArcs = [
    ...(layers.missiles ? missileArcs : []),
    ...(layers.flights  ? flightArcs : []),
  ];

  // HTML elements for conflict cards
  const makeHtmlEl = (d: ConflictEvent) => {
    const el = document.createElement('div');
    el.style.cssText = 'pointer-events:auto;cursor:pointer;';
    el.innerHTML = `
      <div style="padding:6px 8px;background:rgba(10,10,15,0.92);border:1px solid rgba(100,100,120,0.45);
        border-radius:6px;width:180px;transform:translate(16px,-50%);font-family:monospace;
        display:flex;flex-direction:column;gap:4px;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${d.color.replace('0.9','1')}">
            ${d.type.replace(/_/g,' ')}
          </span>
          <span style="font-size:9px;color:#6b7280">${d.time}</span>
        </div>
        <div style="font-size:11px;color:#e5e7eb;line-height:1.3">${d.title}</div>
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#6b7280;margin-top:2px">
          <span>${d.countryTags.join(' · ')}</span>
          <span>${d.sourceCount} src</span>
        </div>
      </div>`;
    el.onclick = (e) => {
      e.stopPropagation();
      setSelected(d);
      setSelType('conflict');
      globeEl.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.2 }, 800);
    };
    return el;
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-[#08080c] rounded-lg">

      {/* Layer Toggles */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
        {LAYER_CONFIG.map(({ key, label, icon: Icon, color }) => {
          const on = layers[key as keyof typeof layers];
          return (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded text-[10px] font-bold tracking-wider border transition-all backdrop-blur-md"
              style={on
                ? { background: 'rgba(0,0,0,0.75)', borderColor: color + '55', color }
                : { background: 'rgba(0,0,0,0.4)', borderColor: '#27272a', color: '#52525b' }
              }
            >
              <Icon className="w-3 h-3" style={{ color: on ? color : '#52525b' }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Bottom-left mode controls */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1.5">
        {/* WAR MODE */}
        <button
          onClick={() => setWarMode(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-xs tracking-wider border backdrop-blur-md transition-all ${
            warMode
              ? 'bg-red-950/60 text-red-400 border-red-700/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
              : 'bg-black/60 text-neutral-400 border-neutral-800/50 hover:border-neutral-600'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          {warMode ? 'WAR MODE ACTIVE' : 'WAR SIGNALS'}
        </button>

        {/* SATELLITE VIEW */}
        <button
          onClick={() => setSatellite(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-xs tracking-wider border backdrop-blur-md transition-all ${
            satellite
              ? 'bg-sky-950/60 text-sky-300 border-sky-600/50 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
              : 'bg-black/60 text-neutral-400 border-neutral-800/50 hover:border-neutral-600'
          }`}
        >
          <Satellite className="w-4 h-4" />
          {satellite
            ? satReady ? `SAT LIVE · ${satDate}` : 'SAT LOADING…'
            : 'SATELLITE VIEW'}
          {satellite && satReady && (
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse ml-0.5" />
          )}
        </button>

        {/* CLOUDS (only shown in satellite mode) */}
        {satellite && (
          <button
            onClick={() => setClouds(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md font-bold text-xs tracking-wider border backdrop-blur-md transition-all ${
              clouds
                ? 'bg-white/10 text-white border-white/30 shadow-[0_0_12px_rgba(255,255,255,0.08)]'
                : 'bg-black/60 text-neutral-400 border-neutral-800/50 hover:border-neutral-600'
            }`}
          >
            <Cloud className="w-4 h-4" />
            {clouds ? 'CLOUDS ON' : 'CLOUDS OFF'}
          </button>
        )}
      </div>

      {/* SIGINT footer */}
      <div className="absolute bottom-3 right-3 z-10 text-right text-[9px] font-mono text-neutral-600 space-y-0.5 pointer-events-none">
        <div className="text-green-600">● SIGINT FEED ONLINE</div>
        {feedStale && <div className="text-amber-500">LIVE FEED DEGRADED (STALE CACHE)</div>}
        {satellite && satReady
          ? <div className="text-sky-500">SAT DOWNLINK: MODIS TERRA · {satDate}</div>
          : <div>SATELLITE DOWNLINK: SECURE</div>
        }
        <div>{conflictEvents.length} ACTIVE EVENTS</div>
      </div>

      {/* Globe — all props always declared to avoid react-globe.gl internal null errors */}
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Globe
          ref={globeEl}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl={globeImageUrl}
          bumpImageUrl={satellite ? undefined : '//unpkg.com/three-globe/example/img/earth-topology.png'}
          backgroundColor="rgba(8,8,12,1)"
          atmosphereColor={warMode ? '#ff4444' : satellite ? '#38bdf8' : '#4f8ef7'}
          atmosphereAltitude={satellite ? 0.12 : 0.15}

          // ── Conflict rings ──
          ringsData={layers.conflicts ? conflictEvents : []}
          ringColor={(d: ConflictEvent) => d.color}
          ringMaxRadius={5}
          ringPropagationSpeed={3}
          ringRepeatPeriod={1000}

          // ── Conflict HTML cards ──
          htmlElementsData={layers.conflicts ? conflictEvents : []}
          htmlLat={(d: ConflictEvent) => d.lat}
          htmlLng={(d: ConflictEvent) => d.lng}
          htmlElement={(d: ConflictEvent) => makeHtmlEl(d)}

          // ── Merged arcs (missiles + flights) ──
          arcsData={activeArcs}
          arcStartLat={(d: MapArc) => d.startLat}
          arcStartLng={(d: MapArc) => d.startLng}
          arcEndLat={(d: MapArc) => d.endLat}
          arcEndLng={(d: MapArc) => d.endLng}
          arcColor={(d: MapArc) => d.color}
          arcDashLength={0.45}
          arcDashGap={0.15}
          arcDashInitialGap={() => Math.random()}
          arcDashAnimateTime={(d: MapArc) => d.layer === 'flights' ? 2200 : 1100}
          arcAltitudeAutoScale={0.3}
          arcStroke={0.9}

          // ── Vessels as points ──
          pointsData={layers.vessels ? vessels : []}
          pointLat={(d: VesselPoint) => d.lat}
          pointLng={(d: VesselPoint) => d.lng}
          pointColor={(d: VesselPoint) => d.color}
          pointAltitude={0.015}
          pointRadius={1.2}
          pointLabel={(d: VesselPoint) => `<div style="font-family:monospace;font-size:11px;background:rgba(0,0,0,0.8);padding:4px 8px;border-radius:4px;border:1px solid #404040;color:#e5e7eb">${d.name}<br/><span style="color:#6b7280">${d.type} · ${d.flag} · ${typeof d.speed === 'number' ? `${Math.round(d.speed)} kts` : 'speed n/a'}</span></div>`}
          onPointClick={(d: VesselPoint) => {
            setSelected(d);
            setSelType('vessel');
            globeEl.current?.pointOfView({ lat: d.lat, lng: d.lng, altitude: 1.0 }, 800);
          }}
          onGlobeReady={() => setGlobeReady(true)}
        />
      )}

      {/* Detail Panel */}
      {selected && (
        <div className="absolute top-0 right-0 bottom-0 w-[272px] z-20 bg-[#0a0a0f]/96 backdrop-blur-xl border-l border-neutral-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between shrink-0">
            <div>
              <div className={`text-[9px] font-bold tracking-widest mb-0.5 ${
                selType === 'conflict'
                  ? selected.severity === 'CRITICAL' ? 'text-red-500' : 'text-orange-500'
                  : 'text-blue-400'
              }`}>
                {selType === 'conflict' ? selected.type?.replace(/_/g,' ').toUpperCase() : `${selected.type?.toUpperCase()} · ${selected.flag}`}
              </div>
              <div className="text-white font-bold text-sm font-mono">{selected.name || selected.title}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-neutral-500 hover:text-neutral-200 transition-colors ml-2 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs font-mono">
            {selType === 'conflict' && (
              <>
                <div className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                  selected.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-400 border-red-500/25' :
                  selected.severity === 'HIGH'     ? 'bg-orange-500/15 text-orange-400 border-orange-500/25' :
                                                     'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
                }`}>{selected.severity} ALERT</div>

                <div>
                  <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">PARTIES</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {selected.countryTags?.map((c: string) => (
                      <span key={c} className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-200">{c}</span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">SITREP</div>
                  <p className="text-neutral-300 leading-relaxed">{selected.details}</p>
                </div>

                <div>
                  <div className="text-[9px] text-neutral-500 tracking-widest mb-1.5">MARKET IMPACT</div>
                  <div className="bg-neutral-900 border border-neutral-800 rounded p-2 text-green-400">{selected.marketImpact}</div>
                </div>

                <div className="flex justify-between text-neutral-600">
                  <span>{selected.sourceCount} sources</span><span>{selected.time}</span>
                </div>
              </>
            )}

            {selType === 'vessel' && (
              <>
                <div className="inline-block text-[10px] font-bold px-2 py-0.5 rounded border bg-blue-500/15 text-blue-400 border-blue-500/25">
                  {selected.type?.toUpperCase()} · {selected.flag}
                </div>

                <div>
                  <div className="text-[9px] text-neutral-500 tracking-widest mb-1">POSITION</div>
                  <div className="text-neutral-300">{formatCoord(selected.lat, 'lat')}  {formatCoord(selected.lng, 'lng')}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[['SPEED', formatMetric(selected.speed, ' kts')], ['HEADING', formatMetric(selected.heading, '°')]].map(([label, val]) => (
                    <div key={label} className="bg-neutral-900 border border-neutral-800 rounded p-2">
                      <div className="text-[9px] text-neutral-500 mb-0.5">{label}</div>
                      <div className="font-bold text-blue-400">{val}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-[9px] text-neutral-500 tracking-widest mb-1">INTEL</div>
                  <p className="text-neutral-300 leading-relaxed">{selected.details}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
