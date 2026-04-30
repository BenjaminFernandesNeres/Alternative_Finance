"""Live map intel endpoint for GlobeMap (no hardcoded mock feeds)."""

from __future__ import annotations

import csv
import io
import math
import zipfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException, Query
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

router = APIRouter()

GDELT_LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"
OPENSKY_STATES_URL = "https://opensky-network.org/api/states/all"

_CONFLICT_ROOT_CODES = {"18", "19", "20"}
_MARITIME_HINTS = (
    "ship",
    "vessel",
    "tanker",
    "maritime",
    "naval",
    "port",
    "strait",
    "hormuz",
    "red-sea",
    "redsea",
)

_CACHE: Dict[str, Any] = {
    "payload": None,
    "updated_epoch": 0,
}
_CACHE_TTL_SECONDS = 75


# 0-based GDELT column indexes (v2 export)
COL_GLOBALEVENTID = 0
COL_SQLDATE = 1
COL_ACTOR1NAME = 6
COL_ACTOR1COUNTRY = 15
COL_ACTOR2NAME = 16
COL_ACTOR2COUNTRY = 25
COL_EVENTCODE = 26
COL_EVENTROOTCODE = 28
COL_GOLDSTEIN = 34
COL_ACTION_GEO_FULLNAME = 44
COL_ACTION_GEO_LAT = 48
COL_ACTION_GEO_LNG = 49
COL_ACTOR1_GEO_LAT = 56
COL_ACTOR1_GEO_LNG = 57
COL_LAST_UPDATE_TS = 59
COL_SOURCE_URL = 60


def _session() -> requests.Session:
    retry = Retry(
        total=2,
        read=2,
        connect=2,
        backoff_factor=0.35,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    s = requests.Session()
    s.mount("http://", adapter)
    s.mount("https://", adapter)
    return s


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _parse_sql_date(value: str) -> Optional[datetime]:
    try:
        return datetime.strptime(value, "%Y%m%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _parse_ts(value: str) -> Optional[datetime]:
    try:
        return datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _relative_time(when: Optional[datetime]) -> str:
    if when is None:
        return "unknown"
    now = datetime.now(timezone.utc)
    diff = max(int((now - when).total_seconds()), 0)
    if diff < 60:
        return "just now"
    if diff < 3600:
        return f"{diff // 60}m ago"
    if diff < 86400:
        return f"{diff // 3600}h ago"
    return f"{diff // 86400}d ago"


def _severity_from_goldstein(score: Optional[float]) -> str:
    if score is None:
        return "MEDIUM"
    v = abs(score)
    if v >= 7:
        return "CRITICAL"
    if v >= 4:
        return "HIGH"
    return "MEDIUM"


def _color_from_severity(severity: str) -> str:
    if severity == "CRITICAL":
        return "rgba(239,68,68,0.9)"
    if severity == "HIGH":
        return "rgba(249,115,22,0.9)"
    return "rgba(234,179,8,0.9)"


def _distance_deg(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    return math.hypot(a_lat - b_lat, a_lng - b_lng)


def _fetch_latest_gdelt_rows(limit: int) -> List[List[str]]:
    s = _session()
    lu = s.get(GDELT_LASTUPDATE_URL, timeout=(6, 20), headers={"User-Agent": "WarSignals/0.3 (+live-map)"})
    lu.raise_for_status()

    lines = [line.strip() for line in lu.text.splitlines() if line.strip()]
    if not lines:
        return []

    export_url = lines[0].split()[-1]
    if not export_url.endswith(".export.CSV.zip"):
        return []

    export_resp = s.get(export_url, timeout=(8, 35), headers={"User-Agent": "WarSignals/0.3 (+live-map)"})
    export_resp.raise_for_status()

    rows: List[List[str]] = []
    with zipfile.ZipFile(io.BytesIO(export_resp.content)) as zf:
        names = zf.namelist()
        if not names:
            return []

        with zf.open(names[0]) as fh:
            text_stream = io.TextIOWrapper(fh, encoding="utf-8", errors="replace")
            reader = csv.reader(text_stream, delimiter="\t")
            for row in reader:
                if len(row) < 61:
                    continue
                rows.append(row)
                if len(rows) >= limit:
                    break

    return rows


def _build_conflicts(rows: List[List[str]], limit: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        root = row[COL_EVENTROOTCODE]
        if root not in _CONFLICT_ROOT_CODES:
            continue

        lat = _safe_float(row[COL_ACTION_GEO_LAT])
        lng = _safe_float(row[COL_ACTION_GEO_LNG])
        if lat is None or lng is None:
            continue

        event_code = row[COL_EVENTCODE]
        goldstein = _safe_float(row[COL_GOLDSTEIN])
        severity = _severity_from_goldstein(goldstein)

        actor1 = (row[COL_ACTOR1NAME] or "Actor-1").strip()
        actor2 = (row[COL_ACTOR2NAME] or "Actor-2").strip()
        location = (row[COL_ACTION_GEO_FULLNAME] or "Unknown location").strip()
        source_url = row[COL_SOURCE_URL]
        source_host = urlparse(source_url).netloc or "unknown"

        seen_dt = _parse_ts(row[COL_LAST_UPDATE_TS]) or _parse_sql_date(row[COL_SQLDATE])

        tags = [c for c in (row[COL_ACTOR1COUNTRY], row[COL_ACTOR2COUNTRY]) if c]
        if not tags:
            tags = ["UN"]

        out.append(
            {
                "id": f"gdelt_{row[COL_GLOBALEVENTID]}",
                "lat": lat,
                "lng": lng,
                "title": f"{actor1} vs {actor2} near {location}",
                "type": "armed_conflict" if root == "19" else "military_buildup",
                "countryTags": tags[:2],
                "sourceCount": 1,
                "time": _relative_time(seen_dt),
                "color": _color_from_severity(severity),
                "severity": severity,
                "marketImpact": f"Live GDELT event code {event_code}",
                "details": f"RootCode {root}, Goldstein {goldstein if goldstein is not None else 'n/a'}, source {source_host}",
                "sourceUrl": source_url,
            }
        )

        if len(out) >= limit:
            break

    return out


def _build_missile_arcs(rows: List[List[str]], limit: int) -> List[Dict[str, Any]]:
    arcs: List[Dict[str, Any]] = []
    for row in rows:
        root = row[COL_EVENTROOTCODE]
        if root != "19":
            continue

        start_lat = _safe_float(row[COL_ACTOR1_GEO_LAT])
        start_lng = _safe_float(row[COL_ACTOR1_GEO_LNG])
        end_lat = _safe_float(row[COL_ACTION_GEO_LAT])
        end_lng = _safe_float(row[COL_ACTION_GEO_LNG])
        if None in (start_lat, start_lng, end_lat, end_lng):
            continue

        if _distance_deg(start_lat or 0, start_lng or 0, end_lat or 0, end_lng or 0) < 0.2:
            continue

        arcs.append(
            {
                "id": f"m_{row[COL_GLOBALEVENTID]}",
                "startLat": start_lat,
                "startLng": start_lng,
                "endLat": end_lat,
                "endLng": end_lng,
                "color": ["rgba(255,60,60,0.9)", "rgba(255,60,60,0.0)"],
                "layer": "missiles",
            }
        )

        if len(arcs) >= limit:
            break

    return arcs


def _build_vessels_from_maritime_events(rows: List[List[str]], limit: int) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen_ids = set()

    for row in rows:
        source_url = (row[COL_SOURCE_URL] or "").lower()
        actor1 = (row[COL_ACTOR1NAME] or "").lower()
        actor2 = (row[COL_ACTOR2NAME] or "").lower()
        location = (row[COL_ACTION_GEO_FULLNAME] or "").lower()
        haystack = " ".join([source_url, actor1, actor2, location])

        if not any(k in haystack for k in _MARITIME_HINTS):
            continue

        lat = _safe_float(row[COL_ACTION_GEO_LAT])
        lng = _safe_float(row[COL_ACTION_GEO_LNG])
        if lat is None or lng is None:
            continue

        ev_id = f"v_{row[COL_GLOBALEVENTID]}"
        if ev_id in seen_ids:
            continue
        seen_ids.add(ev_id)

        actor_name = (row[COL_ACTOR1NAME] or row[COL_ACTOR2NAME] or "Maritime contact").strip()
        flag = (row[COL_ACTOR1COUNTRY] or row[COL_ACTOR2COUNTRY] or "UN").strip()
        loc = (row[COL_ACTION_GEO_FULLNAME] or "Open water").strip()

        out.append(
            {
                "id": ev_id,
                "lat": lat,
                "lng": lng,
                "name": actor_name,
                "type": "maritime",
                "flag": flag,
                "heading": None,
                "speed": None,
                "color": "#3b82f6",
                "details": f"Live maritime signal near {loc}. Source: {urlparse(row[COL_SOURCE_URL]).netloc or 'unknown'}",
            }
        )

        if len(out) >= limit:
            break

    return out


def _calc_back_projected_position(lat: float, lng: float, velocity_mps: float, true_track_deg: float, seconds: int) -> Dict[str, float]:
    distance_km = max(velocity_mps, 0.0) * seconds / 1000.0
    rad = math.radians(true_track_deg)

    d_lat = (distance_km * math.cos(rad)) / 111.0
    cos_lat = max(math.cos(math.radians(lat)), 0.2)
    d_lng = (distance_km * math.sin(rad)) / (111.0 * cos_lat)

    start_lat = max(min(lat - d_lat, 85.0), -85.0)
    start_lng = lng - d_lng
    while start_lng > 180.0:
        start_lng -= 360.0
    while start_lng < -180.0:
        start_lng += 360.0

    return {"lat": start_lat, "lng": start_lng}


def _build_flight_arcs(limit: int) -> List[Dict[str, Any]]:
    s = _session()
    resp = s.get(OPENSKY_STATES_URL, timeout=(8, 30), headers={"User-Agent": "WarSignals/0.3 (+live-map)"})
    resp.raise_for_status()

    payload = resp.json()
    states = payload.get("states") or []

    arcs: List[Dict[str, Any]] = []
    for st in states:
        if len(st) < 11:
            continue

        icao24 = st[0] or "unknown"
        lng = _safe_float(st[5])
        lat = _safe_float(st[6])
        velocity = _safe_float(st[9])
        track = _safe_float(st[10])
        on_ground = bool(st[8])

        if lat is None or lng is None or velocity is None or track is None:
            continue
        if on_ground or velocity < 70.0:
            continue

        start = _calc_back_projected_position(lat, lng, velocity, track, seconds=480)

        arcs.append(
            {
                "id": f"f_{icao24}",
                "startLat": start["lat"],
                "startLng": start["lng"],
                "endLat": lat,
                "endLng": lng,
                "color": ["rgba(96,165,250,0.8)", "rgba(96,165,250,0.0)"],
                "layer": "flights",
            }
        )

        if len(arcs) >= limit:
            break

    return arcs


@router.get("/live-map")
def get_live_map_intel(
    conflict_limit: int = Query(24, ge=5, le=80),
    missile_limit: int = Query(30, ge=5, le=120),
    flight_limit: int = Query(80, ge=10, le=200),
    vessel_limit: int = Query(28, ge=5, le=100),
):
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    cached = _CACHE.get("payload")
    updated = int(_CACHE.get("updated_epoch") or 0)
    if cached and now_epoch - updated <= _CACHE_TTL_SECONDS:
        return cached

    try:
        gdelt_rows = _fetch_latest_gdelt_rows(limit=6000)
        conflicts = _build_conflicts(gdelt_rows, limit=conflict_limit)
        missiles = _build_missile_arcs(gdelt_rows, limit=missile_limit)
        vessels = _build_vessels_from_maritime_events(gdelt_rows, limit=vessel_limit)

        # If no direct missile trajectories are available, derive arcs between live conflict hotspots.
        if not missiles and len(conflicts) > 1:
            derived = []
            for idx in range(min(len(conflicts) - 1, missile_limit)):
                a = conflicts[idx]
                b = conflicts[idx + 1]
                derived.append(
                    {
                        "id": f"m_derived_{idx}",
                        "startLat": a["lat"],
                        "startLng": a["lng"],
                        "endLat": b["lat"],
                        "endLng": b["lng"],
                        "color": ["rgba(255,120,40,0.85)", "rgba(255,120,40,0.0)"],
                        "layer": "missiles",
                    }
                )
            missiles = derived

        flights = _build_flight_arcs(limit=flight_limit)

    except Exception as exc:
        stale_payload = _CACHE.get("payload")
        if stale_payload:
            stale_payload["stale"] = True
            stale_payload["error"] = str(exc)
            return stale_payload
        raise HTTPException(status_code=502, detail=f"Failed to build live map intel: {exc}") from exc

    payload = {
        "provider": "GDELT+OpenSky",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "stale": False,
        "conflicts": conflicts,
        "missiles": missiles,
        "flights": flights,
        "vessels": vessels,
        "counts": {
            "conflicts": len(conflicts),
            "missiles": len(missiles),
            "flights": len(flights),
            "vessels": len(vessels),
        },
    }

    _CACHE["payload"] = payload
    _CACHE["updated_epoch"] = now_epoch

    return payload
