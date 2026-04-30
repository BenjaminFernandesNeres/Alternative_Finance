"""
Live news endpoint powered by GDELT DOC API.
Returns geopolitics-focused articles normalized for the frontend NewsPanel.
"""
from datetime import datetime, timezone
from typing import Dict, List
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import requests
from fastapi import APIRouter, HTTPException, Query
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

router = APIRouter()

GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
GDELT_QUERY = "(war OR conflict OR military OR sanctions OR oil OR gas OR shipping OR missile OR drone OR diplomacy)"
RSS_FEEDS = [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
]

_CACHE: Dict[str, object] = {
    "items": [],
    "updated_at": None,
}


def _to_source_name(domain: str, url: str) -> str:
    if domain:
        return domain
    if not url:
        return "Unknown"
    return urlparse(url).netloc or "Unknown"


def _parse_seen_date(seen_date: str) -> datetime:
    return datetime.strptime(seen_date, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def _relative_time(when: datetime) -> str:
    now = datetime.now(timezone.utc)
    diff = max(int((now - when).total_seconds()), 0)
    if diff < 60:
        return "just now"
    if diff < 3600:
        return f"{diff // 60}m ago"
    if diff < 86400:
        return f"{diff // 3600}h ago"
    return f"{diff // 86400}d ago"


def _classify_article(title: str) -> Dict[str, object]:
    text = title.lower()

    high_markers = ["attack", "strike", "missile", "drone", "shell", "invasion", "explosion", "killed"]
    medium_markers = ["military", "sanction", "tension", "exercise", "naval", "ceasefire", "security"]

    if any(k in text for k in high_markers):
        severity = "high"
        sentiment = -0.82
    elif any(k in text for k in medium_markers):
        severity = "medium"
        sentiment = -0.56
    else:
        severity = "low"
        sentiment = -0.28

    tags: List[str] = []
    if any(k in text for k in ["war", "conflict", "military", "missile", "drone", "naval"]):
        tags.append("MILITARY")
    if any(k in text for k in ["sanction", "diplom", "un ", "security council"]):
        tags.append("DIPLOMACY")
    if any(k in text for k in ["oil", "gas", "pipeline", "lng", "energy"]):
        tags.append("ENERGY")
    if any(k in text for k in ["shipping", "port", "strait", "red sea", "hormuz"]):
        tags.append("SHIPPING")

    if not tags:
        tags.append("GEOPOLITICAL")

    related_tickers: List[str] = ["SPY"]
    if "energy" in tags:
        related_tickers = ["USO", "UNG", "XOM"]
    elif "SHIPPING" in tags:
        related_tickers = ["ZIM", "FDX", "DAL"]
    elif "MILITARY" in tags:
        related_tickers = ["GLD", "USO", "TLT"]

    return {
        "severity": severity,
        "sentiment": sentiment,
        "tags": tags,
        "relatedTickers": related_tickers,
    }


def _normalize_rss_items(limit: int) -> List[Dict[str, object]]:
    session = requests.Session()
    items: List[Dict[str, object]] = []

    for feed in RSS_FEEDS:
        try:
            resp = session.get(feed, timeout=(8, 20), headers={"User-Agent": "WarSignals/0.2 (+rss-fallback)"})
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            channel = root.find("channel")
            if channel is None:
                continue

            for idx, item in enumerate(channel.findall("item")):
                title = (item.findtext("title") or "Untitled").strip()
                link = (item.findtext("link") or "").strip()
                pub_date_raw = (item.findtext("pubDate") or "").strip()

                if pub_date_raw:
                    try:
                        seen_dt = datetime.strptime(pub_date_raw, "%a, %d %b %Y %H:%M:%S %Z").replace(tzinfo=timezone.utc)
                    except ValueError:
                        seen_dt = datetime.now(timezone.utc)
                else:
                    seen_dt = datetime.now(timezone.utc)

                classified = _classify_article(title)
                items.append(
                    {
                        "id": f"rss_news_{abs(hash(feed + link))}_{idx}",
                        "source": _to_source_name("", link),
                        "time": _relative_time(seen_dt),
                        "severity": classified["severity"],
                        "tags": classified["tags"],
                        "title": title,
                        "sentiment": classified["sentiment"],
                        "relatedTickers": classified["relatedTickers"],
                        "geoImpact": "Global",
                        "fullText": f"{title}\n\nSource: {_to_source_name('', link)}",
                        "sourceUrl": link,
                    }
                )
                if len(items) >= limit:
                    return items
        except Exception:
            continue

    return items[:limit]


@router.get("/live")
def get_live_news(limit: int = Query(20, ge=1, le=50)):
    retry = Retry(
        total=2,
        read=2,
        connect=2,
        backoff_factor=0.4,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session = requests.Session()
    session.mount("https://", adapter)

    candidate_queries = [
        GDELT_QUERY,
        "(war OR conflict OR military OR sanctions)",
        "war",
    ]

    payload = None
    fetch_error = None
    for query in candidate_queries:
        params = {
            "query": query,
            "mode": "ArtList",
            "maxrecords": limit,
            "format": "json",
            "sort": "datedesc",
        }
        try:
            resp = session.get(
                GDELT_DOC_URL,
                params=params,
                timeout=(8, 20),
                headers={"User-Agent": "WarSignals/0.2 (+live-news)"},
            )
            resp.raise_for_status()
            payload = resp.json()
            if payload.get("articles"):
                break
        except Exception as exc:
            fetch_error = exc
            continue

    if payload is None:
        rss_items = _normalize_rss_items(limit)
        if rss_items:
            _CACHE["items"] = rss_items
            _CACHE["updated_at"] = datetime.now(timezone.utc).isoformat()
            return {
                "items": rss_items,
                "provider": "RSS_FALLBACK",
                "count": len(rss_items),
                "stale": False,
                "updatedAt": _CACHE["updated_at"],
            }

        cached_items = _CACHE.get("items") or []
        cached_ts = _CACHE.get("updated_at")
        if cached_items and cached_ts:
            return {
                "items": cached_items[:limit],
                "provider": "GDELT",
                "count": min(len(cached_items), limit),
                "stale": True,
                "updatedAt": cached_ts,
            }
        raise HTTPException(status_code=502, detail=f"Failed to fetch live GDELT news: {fetch_error}") from fetch_error

    articles = payload.get("articles") or []
    items = []
    for idx, article in enumerate(articles):
        title = (article.get("title") or "Untitled").strip()
        source_url = article.get("url") or ""
        source = _to_source_name(article.get("domain", ""), source_url)

        seen_raw = article.get("seendate")
        if seen_raw:
            try:
                seen_dt = _parse_seen_date(seen_raw)
            except ValueError:
                seen_dt = datetime.now(timezone.utc)
        else:
            seen_dt = datetime.now(timezone.utc)

        classified = _classify_article(title)
        geo_impact = article.get("sourcecountry") or "Global"

        items.append(
            {
                "id": f"gdelt_news_{idx}_{abs(hash(source_url))}",
                "source": source,
                "time": _relative_time(seen_dt),
                "severity": classified["severity"],
                "tags": classified["tags"],
                "title": title,
                "sentiment": classified["sentiment"],
                "relatedTickers": classified["relatedTickers"],
                "geoImpact": geo_impact,
                "fullText": f"{title}\n\nSource: {source}",
                "sourceUrl": source_url,
            }
        )

    _CACHE["items"] = items
    _CACHE["updated_at"] = datetime.now(timezone.utc).isoformat()

    return {
        "items": items,
        "provider": "GDELT",
        "count": len(items),
        "stale": False,
        "updatedAt": _CACHE["updated_at"],
    }
