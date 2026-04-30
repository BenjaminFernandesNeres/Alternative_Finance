/**
 * Centralized API and WebSocket URL helpers.
 * All base URLs are driven by environment variables so deployments
 * only need to set NEXT_PUBLIC_API_URL / NEXT_PUBLIC_WS_URL.
 *
 * Defaults target the local dev backend (http://127.0.0.1:8000).
 * Using 127.0.0.1 avoids localhost IPv6 resolution issues seen on some browsers.
 */

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, ""); // strip trailing slash

const WS_BASE = (
  process.env.NEXT_PUBLIC_WS_URL ??
  API_BASE.replace(/^http/, "ws")         // http→ws, https→wss
).replace(/\/$/, "");

/** Build an absolute REST API URL.  e.g. apiUrl("/trading/orders") */
export function apiUrl(path: string): string {
  return `${API_BASE}/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

/** WebSocket price-stream URL. */
export const WS_PRICES_URL = `${WS_BASE}/ws/prices`;

/** Convenience: market bars URL for a given symbol and timeframe. */
export function barsUrl(symbol: string, timeframe = "1Day", limit = 60): string {
  return apiUrl(`/market/bars/${encodeURIComponent(symbol)}?timeframe=${timeframe}&limit=${limit}`);
}

/** Live GeoINT map feed URL for GlobeMap. */
export function geointMapUrl(conflictLimit = 24, missileLimit = 30, flightLimit = 80, vesselLimit = 28): string {
  return apiUrl(
    `/geoint/live-map?conflict_limit=${conflictLimit}&missile_limit=${missileLimit}&flight_limit=${flightLimit}&vessel_limit=${vesselLimit}`
  );
}
