'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

// ── INTEL FEED PANEL ────────────────────────────────────────────────────────

const SOURCE_TABS = ['All', 'X', 'GDELT', 'RSS', 'Poly', 'Video', 'TG'] as const;
const TIME_FILTERS = ['1H', '6H', '24H', '48H', '7D'] as const;

const SOURCE_ICONS: Record<string, string> = {
  X: '𝕏', GDELT: '◉', RSS: '◈', Poly: '⟁', Video: '▶', TG: '✈', All: '⊞'
};

const INTEL_FEED_ITEMS = [
  {
    id: 'if1', source: 'AirNav Radar', sourcetype: 'X', verified: true,
    time: '2 min ago', region: null,
    text: '@FlightEmergency: Ryanair flight FR1071 CTA-MXP Squawking 7700 (emergency) Track here 👉 airnavradar.go.link/bSXsu @AirNavRada…',
    severity: 'high',
  },
  {
    id: 'if2', source: 'Bloomberg', sourcetype: 'X', verified: true,
    time: '8 min ago', region: 'United States',
    text: 'The Trump administration said it\'s making progress on building a web-based portal to handle refund requests for almost $170 billion in glob…',
    severity: 'medium',
  },
  {
    id: 'if3', source: 'Bloomberg', sourcetype: 'X', verified: true,
    time: '14 min ago', region: null,
    text: 'Here\'s what you need to know to start your day bloomberg.com/news/newslette…',
    severity: 'low',
  },
  {
    id: 'if4', source: 'WSJ', sourcetype: 'X', verified: true,
    time: '17 min ago', region: null,
    text: 'Markets extend losses as trade war tensions mount between major economic blocs. Safe-haven assets surge.',
    severity: 'high',
  },
  {
    id: 'if5', source: 'Reuters', sourcetype: 'RSS', verified: true,
    time: '23 min ago', region: 'Middle East',
    text: 'Tankers reroute as Red Sea tensions escalate following new drone strike reports near Bab el-Mandeb strait.',
    severity: 'high',
  },
  {
    id: 'if6', source: 'AP', sourcetype: 'RSS', verified: true,
    time: '31 min ago', region: 'Ukraine',
    text: 'Drone strike damages Odessa grain terminal overnight. Local authorities assessing full operational impact.',
    severity: 'high',
  },
  {
    id: 'if7', source: 'Financial Times', sourcetype: 'RSS', verified: true,
    time: '45 min ago', region: 'Global',
    text: 'OPEC+ signals potential extension of production cuts into Q3, citing continued demand uncertainty.',
    severity: 'medium',
  },
  {
    id: 'if8', source: 'SCMP', sourcetype: 'RSS', verified: true,
    time: '1h ago', region: 'China',
    text: 'Chinese property sector stimulus measures announced; analysts remain cautious on follow-through.',
    severity: 'medium',
  },
  {
    id: 'if9', source: 'NavyLookout', sourcetype: 'X', verified: false,
    time: '1h ago', region: 'S. China Sea',
    text: 'Unusual naval activity detected: three guided-missile destroyers operating near contested territorial waters.',
    severity: 'medium',
  },
  {
    id: 'if10', source: 'OsintDefender', sourcetype: 'X', verified: false,
    time: '2h ago', region: 'Black Sea',
    text: 'Satellite imagery confirms Russian naval repositioning in Black Sea — second carrier-capable group now visible.',
    severity: 'high',
  },
];

export function IntelFeedPanel({ events }: { events: any[] }) {
  const [activeTab, setActiveTab] = useState<typeof SOURCE_TABS[number]>('All');
  const [activeTime, setActiveTime] = useState<typeof TIME_FILTERS[number]>('24H');

  const today = new Date();
  const dateStr = today.toLocaleString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  // Merge prop events + static intel items
  const allItems = [
    ...INTEL_FEED_ITEMS,
    ...events.map((e) => ({
      id: `ev-${e.id}`,
      source: e.source || 'Unknown',
      sourcetype: 'RSS' as const,
      verified: false,
      time: e.time || 'recently',
      region: e.region || null,
      text: e.title,
      severity: e.severity?.toLowerCase() === 'high' ? 'high' : e.severity?.toLowerCase() === 'medium' ? 'medium' : 'low',
    })),
  ];

  const filtered = activeTab === 'All' ? allItems : allItems.filter((i) => i.sourcetype === activeTab);

  const severityColor = (s: string) =>
    s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#3b82f6';

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(9,11,14,0.95)' }}>
      <div className="flex-1 overflow-hidden flex flex-col">

        {/* Header */}
        <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ color: '#10b981', fontSize: '14px' }}>🔍</span>
            <span style={{ color: '#f9fafb', fontWeight: 800, fontSize: '15px', letterSpacing: '-0.2px' }}>Intel</span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: '8px', padding: '4px 10px', marginLeft: '4px'
            }}>
              <span style={{ fontSize: '12px' }}>📋</span>
              <span style={{ color: '#d1fae5', fontWeight: 700, fontSize: '12px' }}>Latest Brief</span>
              <span style={{
                background: '#10b981', color: '#fff', fontWeight: 800, fontSize: '10px',
                padding: '1px 6px', borderRadius: '5px', letterSpacing: '0.5px'
              }}>{dateStr}</span>
            </div>
          </div>

          {/* Source tabs */}
          <div style={{ display: 'flex', gap: '2px', marginBottom: '8px', overflowX: 'auto', flexShrink: 0 }}>
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700,
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.2px',
                  background: activeTab === tab ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: activeTab === tab ? '#10b981' : '#6b7280',
                  borderBottom: activeTab === tab ? '2px solid #10b981' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab !== 'All' && <span style={{ marginRight: '3px', fontSize: '10px' }}>{SOURCE_ICONS[tab]}</span>}
                {tab}
              </button>
            ))}
          </div>

          {/* Time filter row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
            {TIME_FILTERS.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTime(t)}
                style={{
                  padding: '3px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: 700,
                  cursor: 'pointer', border: '1px solid transparent',
                  background: activeTime === t ? '#10b981' : 'rgba(255,255,255,0.05)',
                  color: activeTime === t ? '#fff' : '#6b7280',
                  transition: 'all 0.15s ease',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '7px', padding: '5px 10px',
          }}>
            <span style={{ color: '#4b5563', fontSize: '12px' }}>🔍</span>
            <input
              type="text" placeholder="Search..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#9ca3af', fontSize: '11px', width: '100%' }}
            />
          </div>
        </div>

        {/* Filter chips */}
        <div style={{
          padding: '7px 10px', display: 'flex', gap: '5px', flexWrap: 'wrap', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          {['Topic ▾', 'Severity ▾', 'Regions ▾', 'Source ▾'].map((chip) => (
            <button
              key={chip}
              style={{
                padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#9ca3af', cursor: 'pointer',
              }}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Feed items */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }} className="custom-scrollbar">
          {filtered.map((item) => (
            <div
              key={item.id}
              style={{
                borderLeft: `3px solid ${severityColor(item.severity)}`,
                margin: '4px 8px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '0 7px 7px 0',
                padding: '10px 10px 10px 12px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            >
              {/* Source row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '12px' }}>
                    {item.sourcetype === 'X' ? '𝕏' : item.sourcetype === 'RSS' ? '◈' : '◉'}
                  </span>
                  <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '11px' }}>{item.source}</span>
                  {item.verified && (
                    <span style={{
                      background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)',
                      borderRadius: '50%', width: '13px', height: '13px', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#10b981', fontWeight: 900,
                    }}>✓</span>
                  )}
                </div>
                <span style={{ color: '#6b7280', fontSize: '10px' }}>{item.time}</span>
              </div>

              {/* Text */}
              <p style={{
                color: '#d1d5db', fontSize: '11px', lineHeight: '1.55',
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', margin: 0,
              }}>
                {item.text}
              </p>

              {/* Region tag */}
              {item.region && (
                <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px' }}>🌐</span>
                  <span style={{ color: '#6b7280', fontSize: '10px' }}>{item.region}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '7px 12px', borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#4b5563', fontSize: '10px', fontWeight: 500 }}>
            {filtered.length} items · Last {activeTime}
          </span>
        </div>
      </div>
    </div>

  );
}

const FLIGHT_LOCATIONS = ['JFK', 'LHR', 'DXB', 'SIN', 'HKG', 'HND', 'CDG', 'FRA', 'LAX', 'SYD', 'YYZ', 'AMS', 'IST', 'MAD', 'DOH'];
const PORT_LOCATIONS = ['Port of Rotterdam', 'Port of Singapore', 'Port of Shanghai', 'Port of Los Angeles', 'Port of Houston', 'Port of Jebel Ali', 'Port of Hamburg', 'Port of Antwerp', 'Port of Busan', 'Port of Qingdao', 'Port of Shenzhen', 'Port of Fujairah', 'Port of Corpus Christi'];

const getRandomFlightRoute = () => {
  const from = FLIGHT_LOCATIONS[Math.floor(Math.random() * FLIGHT_LOCATIONS.length)];
  let to = FLIGHT_LOCATIONS[Math.floor(Math.random() * FLIGHT_LOCATIONS.length)];
  while (to === from) to = FLIGHT_LOCATIONS[Math.floor(Math.random() * FLIGHT_LOCATIONS.length)];
  return { from, to };
};

const getRandomPortRoute = () => {
  const from = PORT_LOCATIONS[Math.floor(Math.random() * PORT_LOCATIONS.length)];
  let to = PORT_LOCATIONS[Math.floor(Math.random() * PORT_LOCATIONS.length)];
  while (to === from) to = PORT_LOCATIONS[Math.floor(Math.random() * PORT_LOCATIONS.length)];
  return { from, to };
};

type Flight = {
  id: string;
  flightNumber: string;
  airline: string;
  from: string;
  to: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string[] | string;
};

type Boat = {
  id: string;
  vesselName: string;
  mmsi: string;
  type: string;
  from: string;
  to: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
};

type Missile = {
  id: string;
  type: string;
  origin: string;
  target: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string | string[];
  status: string;
  description: string;
};

type SelectedItem = {
  type: 'flight' | 'boat' | 'missile';
  data: any;
} | null;

// Helper to generate a random string
const generateId = () => Math.random().toString(36).substring(2, 9);

const COUNTRIES_DATA = [
  { name: 'United States', lat: 39.82, lng: -98.57 },
  { name: 'China', lat: 35.86, lng: 104.19 },
  { name: 'Russia', lat: 61.52, lng: 105.31 },
  { name: 'India', lat: 20.59, lng: 78.96 },
  { name: 'Brazil', lat: -14.23, lng: -51.92 },
  { name: 'United Kingdom', lat: 55.37, lng: -3.43 },
  { name: 'France', lat: 46.22, lng: 2.21 },
  { name: 'Germany', lat: 51.16, lng: 10.45 },
  { name: 'Iran', lat: 32.42, lng: 53.68 },
  { name: 'Saudi Arabia', lat: 23.88, lng: 45.07 },
  { name: 'Australia', lat: -25.27, lng: 133.77 },
  { name: 'Canada', lat: 56.13, lng: -106.34 },
  { name: 'Ukraine', lat: 48.37, lng: 31.16 },
  { name: 'South Africa', lat: -30.55, lng: 22.93 },
  { name: 'Argentina', lat: -38.41, lng: -63.61 }
];

export default function GlobeMap({ events = [], onEventClick }: { events?: any[], onEventClick?: (id: number) => void }) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<any>(null);
  
  const [showWarMode, setShowWarMode] = useState(false);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [boats, setBoats] = useState<Boat[]>([]);
  const [missiles, setMissiles] = useState<Missile[]>([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  useEffect(() => {
    // Generate flights
    const airlines = ['Emirates', 'Qatar Airways', 'Lufthansa', 'Delta', 'Air France', 'British Airways'];
    const mockFlights: Flight[] = [...Array(60).keys()].map(() => {
      const { from, to } = getRandomFlightRoute();
      return {
        id: generateId(),
        flightNumber: `${airlines[Math.floor(Math.random() * airlines.length)].substring(0, 2).toUpperCase()}${Math.floor(Math.random() * 9000) + 1000}`,
        airline: airlines[Math.floor(Math.random() * airlines.length)],
        from,
        to,
        startLat: (Math.random() - 0.5) * 180,
        startLng: (Math.random() - 0.5) * 360,
        endLat: (Math.random() - 0.5) * 180,
        endLng: (Math.random() - 0.5) * 360,
        color: [['#ff3333', '#ffffff'], ['#33ff33', '#ffffff'], ['#33ffff', '#ffffff']][Math.floor(Math.random() * 3)]
      };
    });

    // Generate random global boats
    const vesselTypes = ['Oil Tanker', 'LNG Carrier', 'Bulk Carrier', 'Container Ship'];
    const mockBoats: Boat[] = [...Array(280).keys()].map(() => {
      const { from, to } = getRandomPortRoute();
      return {
        id: generateId(),
        vesselName: `Vessel-${Math.floor(Math.random() * 10000)}`,
        mmsi: `4${Math.floor(Math.random() * 10000000 + 10000000)}`,
        type: vesselTypes[Math.floor(Math.random() * vesselTypes.length)],
        from,
        to,
        lat: (Math.random() - 0.5) * 180,
        lng: (Math.random() - 0.5) * 360,
        size: Math.random() * 0.4 + 0.1,
        color: '#00ffff'
      };
    });

    // Generate specific boats in Strait of Hormuz (Chokepoint)
    // Hormuz Coordinates: ~26.5 Lat, ~56.2 Lng
    const hormuzBoats: Boat[] = [...Array(20).keys()].map((_, i) => {
      const { from, to } = getRandomPortRoute();
      return {
        id: `hormuz_boat_${i}`,
        vesselName: `Hormuz Tanker ${i+1}`,
        mmsi: `42${Math.floor(Math.random() * 1000000 + 1000000)}`,
        type: 'Oil Tanker',
        from,
        to,
        lat: 26.5 + (Math.random() - 0.5) * 0.8,
        lng: 56.2 + (Math.random() - 0.5) * 0.8,
        size: 0.5,
        color: '#ff3333' // Red to highlight these specific vessels
      };
    });

    const mockMissiles: Missile[] = [
      {
        id: 'm1', type: 'Ballistic Missile (Medium Range)', origin: 'Iran (Kermanshah)', target: 'Israel (Tel Aviv)',
        startLat: 34.314, startLng: 47.065, endLat: 32.085, endLng: 34.781, color: ['#ff0000', '#ffaa00'], status: 'Intercepted', description: 'Detected launch towards designated population centers. Intercepted by defense systems.'
      },
      {
        id: 'm2', type: 'Cruise Missile', origin: 'Black Sea Fleet', target: 'Ukraine (Kyiv)',
        startLat: 44.0, startLng: 35.0, endLat: 50.45, endLng: 30.52, color: ['#ff0000', '#ffaa00'], status: 'Impacted', description: 'Cruise missile launched from naval asset targeting energy infrastructure.'
      },
      {
        id: 'm3', type: 'Short Range Tactical', origin: 'Russia (Belgorod)', target: 'Ukraine (Kharkiv)',
        startLat: 50.59, startLng: 36.58, endLat: 49.99, endLng: 36.23, color: ['#ff0000', '#ffaa00'], status: 'Impacted', description: 'Tactical strike near border region.'
      },
      {
        id: 'm4', type: 'Anti-Ship Missile', origin: 'Yemen (Hodeidah)', target: 'Red Sea (Commercial Vessel)',
        startLat: 14.79, startLng: 42.95, endLat: 15.5, endLng: 41.5, color: ['#ff0000', '#ffaa00'], status: 'Missed', description: 'Launch detected from coastal area targeting maritime transit lane.'
      }
    ];

    setFlights(mockFlights);
    setBoats([...mockBoats, ...hormuzBoats]);
    setMissiles(mockMissiles);

    // Initial size
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (events && events.length > 0 && globeRef.current) {
      // Refresh to ensure html markers render correctly on resize/data change
      globeRef.current.controls().update();
    }
  }, [events]);

  const handleZoomToHormuz = () => {
    if (globeRef.current) {
      // Zoom into Strait of Hormuz coordinates
      globeRef.current.pointOfView({ lat: 26.56, lng: 56.25, altitude: 0.4 }, 2000);
      setSelectedItem(null);
    }
  };

  const handleResetZoom = () => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 0, lng: 0, altitude: 2.5 }, 2000);
      setSelectedItem(null);
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[400px] flex items-center justify-center bg-transparent rounded-xl overflow-hidden cursor-move relative">
      {/* 3D Globe */}
      {dimensions.width > 0 && typeof window !== 'undefined' && flights.length > 0 && (

        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          backgroundColor="rgba(0,0,0,0)"
          
          // Flights (Arcs)
          arcsData={showWarMode ? [...flights, ...missiles] : flights}
          arcStartLat={(d: any) => d.startLat}
          arcStartLng={(d: any) => d.startLng}
          arcEndLat={(d: any) => d.endLat}
          arcEndLng={(d: any) => d.endLng}
          arcColor={(d: any) => d.color}
          arcDashLength={(d: any) => d.type ? 0.8 : 0.4} // Missiles have longer dashes
          arcDashGap={(d: any) => d.type ? 0.1 : 0.2}
          arcDashAnimateTime={(d: any) => d.type ? 800 : 2000} // Missiles animate much faster
          arcStroke={(d: any) => d.type ? 1.5 : 0.5} // Missiles are thicker
          onArcClick={(arc: any) => setSelectedItem(arc.type ? { type: 'missile', data: arc } : { type: 'flight', data: arc })}

          // Boats (Points)
          pointsData={boats}
          pointLat={(d: any) => d.lat}
          pointLng={(d: any) => d.lng}
          pointColor={(d: any) => d.color}
          pointAltitude={0.01}
          pointRadius={(d: any) => d.size}
          pointsMerge={false} // Must be false to allow individual clicks
          onPointClick={(point: any) => setSelectedItem({ type: 'boat', data: point })}

          // Countries (Labels)
          labelsData={COUNTRIES_DATA}
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng}
          labelText={(d: any) => d.name}
          labelSize={1.5}
          labelDotRadius={0.5}
          labelColor={() => 'rgba(255, 255, 255, 0.4)'}
          labelResolution={2}

          // News Events (HTML Elements)
          htmlElementsData={events.filter((e) => e.lat && e.lng)}
          htmlLat={(d: any) => d.lat}
          htmlLng={(d: any) => d.lng}
          htmlElement={(d: any) => {
            const el = document.createElement('div');
            el.style.position = 'relative'; 
            
            const color = d.type === 'armed_conflict' ? '#ef4444' : d.type === 'diplomacy' ? '#3b82f6' : '#f97316';
            const icon = d.type === 'armed_conflict' ? '⚔️' : d.type === 'diplomacy' ? '🤝' : '⚠️';
            
            el.innerHTML = `
              <!-- Glowing Point -->
              <div style="
                position: absolute;
                left: 0;
                top: 0;
                transform: translate(-50%, -50%);
                width: 48px;
                height: 48px;
                background: radial-gradient(circle, ${color}50 0%, rgba(0,0,0,0) 70%);
                border-radius: 50%;
                pointer-events: none;
                animation: pulse 2s infinite alternate;
              ">
                <div style="
                  position: absolute;
                  left: 50%;
                  top: 50%;
                  transform: translate(-50%, -50%);
                  width: 12px;
                  height: 12px;
                  background: ${color};
                  border-radius: 50%;
                  box-shadow: 0 0 15px ${color};
                "></div>
              </div>

              <!-- Card -->
              <div class="event-card" style="
                position: absolute;
                left: 20px;
                top: 0;
                transform: translateY(-50%);
                background: rgba(15, 20, 25, 0.75); 
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.05); 
                border-radius: 8px; 
                padding: 12px; 
                width: 220px;
                color: white; 
                cursor: pointer; 
                pointer-events: auto; 
                transition: all 0.2s ease;
                box-shadow: 0 8px 32px rgba(0,0,0,0.5);
              ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px; color: ${color}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                    <span style="font-size: 14px;">${icon}</span>
                    <span>${d.type ? d.type.replace('_', ' ') : 'ALERT'}</span>
                  </div>
                  <div style="color: #6b7280; font-size: 10px; font-weight: 500;">${d.time || 'just now'}</div>
                </div>
                
                <div style="font-size: 12px; font-weight: 500; line-height: 1.5; color: #e5e7eb; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                  ${d.title}
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; gap: 4px;">
                    ${(d.countryTags || []).map((tag: string) => `<span style="background: rgba(255,255,255,0.1); color: #9ca3af; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; border: 1px solid rgba(255,255,255,0.05);">${tag}</span>`).join('')}
                  </div>
                  <div style="color: #6b7280; font-size: 10px; font-weight: 500;">
                     ${d.sourceCount || 1} srcs
                  </div>
                </div>
              </div>
            `;
            el.onclick = () => {
              if (globeRef.current) {
                globeRef.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.8 }, 1000);
              }
              if (onEventClick) onEventClick(d.id);
            };
            el.onmouseenter = () => {
               const card = el.querySelector('.event-card') as HTMLElement;
               if (card) {
                 card.style.transform = 'translateY(-50%) scale(1.05)';
                 card.style.zIndex = '50';
                 card.style.background = 'rgba(20, 25, 30, 0.9)';
                 card.style.border = `1px solid ${color}40`;
               }
            };
            el.onmouseleave = () => {
               const card = el.querySelector('.event-card') as HTMLElement;
               if (card) {
                 card.style.transform = 'translateY(-50%) scale(1)';
                 card.style.zIndex = '1';
                 card.style.background = 'rgba(15, 20, 25, 0.75)';
                 card.style.border = '1px solid rgba(255,255,255,0.05)';
               }
            };
            return el;
          }}
          
          // Missile Impact Points (Rings)
          ringsData={showWarMode ? missiles : []}
          ringLat={(d: any) => d.endLat}
          ringLng={(d: any) => d.endLng}
          ringColor={() => '#ff0000'}
          ringMaxRadius={3}
          ringPropagationSpeed={3}
          ringRepeatPeriod={1500}
        />
      )}
      
      {/* Top Left Search and Settings Overlays */}
      <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-2 z-10">
        <div className="flex gap-2">
          <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 rounded-lg py-2 px-4 shadow-lg flex items-center gap-2 pointer-events-auto w-64">
            <span className="text-neutral-500 text-sm">{'>_'}</span>
            <input type="text" placeholder="search..." className="bg-transparent border-none text-neutral-300 text-sm focus:outline-none w-full placeholder-neutral-500 font-mono" />
            <span className="bg-neutral-800 text-neutral-400 text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 font-mono">⌘K</span>
          </div>
        </div>
        <div className="flex gap-2 mt-1">
          <button className="bg-neutral-900/80 backdrop-blur-md border border-emerald-500/30 rounded-lg py-1.5 px-3 flex items-center gap-2 pointer-events-auto hover:bg-neutral-800/80 transition-colors shadow-lg">
            <span className="text-emerald-400 text-sm">⚙</span>
            <span className="text-emerald-400 text-[10px] font-bold tracking-wider">SETTINGS</span>
            <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 ml-1">1</span>
          </button>
        </div>
      </div>

      {/* Top Right Live Events Info Overlay */}
      <div className="absolute top-4 right-4 pointer-events-none z-10 text-right flex flex-col items-end">
        <div className="text-emerald-400 text-xs font-bold tracking-wider flex items-center gap-2 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          LIVE
        </div>
        <div className="text-[10px] text-neutral-500 mt-3 font-mono leading-relaxed">
          193/196 countries<br/>
          less than a minute ago
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button 
          onClick={() => setShowWarMode(!showWarMode)}
          className={`text-xs px-3 py-2 rounded border transition-colors shadow-lg pointer-events-auto font-bold uppercase tracking-wider flex items-center gap-2 ${
            showWarMode 
              ? 'bg-red-900/80 hover:bg-red-800 text-red-100 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
              : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
          }`}
        >
          {showWarMode && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
          {showWarMode ? 'War Mode Active' : 'War Mode'}
        </button>
        <button 
          onClick={handleZoomToHormuz}
          className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-2 rounded border border-neutral-700 transition-colors shadow-lg pointer-events-auto"
        >
          Zoom to Strait of Hormuz
        </button>
        <button 
          onClick={handleResetZoom}
          className="bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-2 rounded border border-neutral-700 transition-colors shadow-lg pointer-events-auto"
        >
          Reset View
        </button>
      </div>

      {/* Selected Item Info Panel */}
      {selectedItem && (
        <div className="absolute top-4 right-4 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden pointer-events-auto z-10">
          <div className="bg-neutral-800 px-4 py-2 flex justify-between items-center border-b border-neutral-700">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {selectedItem.type === 'flight' ? 'Flight Details' : selectedItem.type === 'missile' ? 'Missile Alert' : 'Vessel Details'}
            </h4>
            <button 
              onClick={() => setSelectedItem(null)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-4 space-y-3">
            {selectedItem.type === 'flight' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">Flight Number</div>
                    <div className="text-sm text-neutral-200 font-medium">{selectedItem.data.flightNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Airline</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.airline}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">From</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.from}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">To</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.to}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-neutral-800 pt-3">
                  <div>
                     <div className="text-xs text-neutral-500">Origin Lat/Lng</div>
                     <div className="text-xs text-neutral-300 font-mono">
                       {selectedItem.data.startLat.toFixed(2)}, {selectedItem.data.startLng.toFixed(2)}
                     </div>
                  </div>
                  <div>
                     <div className="text-xs text-neutral-500">Dest Lat/Lng</div>
                     <div className="text-xs text-neutral-300 font-mono">
                       {selectedItem.data.endLat.toFixed(2)}, {selectedItem.data.endLng.toFixed(2)}
                     </div>
                  </div>
                </div>
              </>
            )}

            {selectedItem.type === 'boat' && (
              <>
                <div>
                  <div className="text-xs text-neutral-500">Vessel Name</div>
                  <div className="text-sm text-neutral-200 font-medium">{selectedItem.data.vesselName}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">Type</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.type}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">MMSI</div>
                    <div className="text-sm text-neutral-200 font-mono">{selectedItem.data.mmsi}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <div className="text-xs text-neutral-500">From</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.from}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">To</div>
                    <div className="text-sm text-neutral-200">{selectedItem.data.to}</div>
                  </div>
                </div>
                <div className="border-t border-neutral-800 pt-3 mt-3">
                  <div className="text-xs text-neutral-500">Current Position</div>
                  <div className="text-xs text-neutral-300 font-mono">
                    Lat: {selectedItem.data.lat.toFixed(4)}, Lng: {selectedItem.data.lng.toFixed(4)}
                  </div>
                </div>
                {selectedItem.data.lat > 25 && selectedItem.data.lat < 28 && selectedItem.data.lng > 54 && selectedItem.data.lng < 58 && (
                   <div className="mt-3 bg-red-500/10 border border-red-500/20 p-2 rounded text-xs text-red-400 font-medium flex items-center gap-2">
                     <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                     High Risk Zone: Strait of Hormuz
                   </div>
                )}
              </>
            )}

            {selectedItem.type === 'missile' && (
              <div className="space-y-3">
                <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-lg flex items-start gap-3">
                  <div className="mt-0.5">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                  <div>
                    <div className="text-red-400 font-bold text-sm">{selectedItem.data.type}</div>
                    <div className="text-xs text-red-400/80">Status: {selectedItem.data.status}</div>
                  </div>
                </div>
                
                <div className="text-xs text-neutral-300 leading-relaxed bg-neutral-950 p-2 rounded border border-neutral-800">
                  {selectedItem.data.description}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-neutral-500">Origin</div>
                    <div className="text-sm text-neutral-200 font-medium">{selectedItem.data.origin}</div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500">Target</div>
                    <div className="text-sm text-neutral-200 font-medium">{selectedItem.data.target}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-neutral-800 pt-3 mt-1">
                  <div>
                     <div className="text-xs text-neutral-500">Launch Coord</div>
                     <div className="text-xs text-neutral-300 font-mono">
                       {selectedItem.data.startLat.toFixed(2)}, {selectedItem.data.startLng.toFixed(2)}
                     </div>
                  </div>
                  <div>
                     <div className="text-xs text-neutral-500">Impact Coord</div>
                     <div className="text-xs text-neutral-300 font-mono">
                       {selectedItem.data.endLat.toFixed(2)}, {selectedItem.data.endLng.toFixed(2)}
                     </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
