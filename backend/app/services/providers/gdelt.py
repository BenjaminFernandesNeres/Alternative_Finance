import logging
import csv
import io
import zipfile
from typing import List, Dict, Any
import httpx
from app.services.providers.base import BaseProvider

logger = logging.getLogger(__name__)

class GDELTProvider(BaseProvider):
    LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"

    def __init__(self):
        super().__init__(provider_name="GDELT")

    async def fetch_raw(self, **kwargs) -> List[Dict[str, Any]]:
        limit = int(kwargs.get("limit", 500))
        if limit <= 0:
            return []

        logger.info("Fetching latest 15-minute GDELT export from website...")
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                lastupdate_resp = await client.get(self.LASTUPDATE_URL)
                lastupdate_resp.raise_for_status()

                lastupdate_lines = [line.strip() for line in lastupdate_resp.text.splitlines() if line.strip()]
                if not lastupdate_lines:
                    logger.warning("GDELT lastupdate.txt returned no data")
                    return []

                latest_export_url = lastupdate_lines[0].split()[-1]
                if not latest_export_url.endswith(".export.CSV.zip"):
                    logger.warning("Unexpected GDELT export URL format: %s", latest_export_url)
                    return []

                export_resp = await client.get(latest_export_url)
                export_resp.raise_for_status()

            with zipfile.ZipFile(io.BytesIO(export_resp.content)) as zf:
                names = zf.namelist()
                if not names:
                    logger.warning("GDELT export zip is empty")
                    return []

                with zf.open(names[0]) as csv_file:
                    text_stream = io.TextIOWrapper(csv_file, encoding="utf-8", errors="replace")
                    reader = csv.reader(text_stream, delimiter="\t")
                    events: List[Dict[str, Any]] = []
                    for row in reader:
                        if len(row) < 61:
                            continue
                        events.append({
                            "GLOBALEVENTID": row[0],
                            "SQLDATE": row[1],
                            "Actor1Name": row[6],
                            "Actor1CountryCode": row[15],
                            "EventCode": row[26],
                            "GoldsteinScale": row[34],
                            "ActionGeo_FullName": row[44],
                            "SOURCEURL": row[60],
                        })
                        if len(events) >= limit:
                            break

                    logger.info("Fetched %s GDELT events from %s", len(events), latest_export_url)
                    return events
        except Exception as exc:
            logger.exception("Failed to fetch GDELT real-time data: %s", exc)
            return []

    def normalize(self, raw_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        normalized = []
        for raw in raw_events:
            event_code = str(raw.get("EventCode", ""))
            goldstein_raw = raw.get("GoldsteinScale", 0)
            try:
                severity_score = abs(float(goldstein_raw))
            except (TypeError, ValueError):
                severity_score = 0.0

            normalized.append({
                "id": f"gdelt_{raw.get('GLOBALEVENTID', 'unknown')}",
                "provider_id": 1, # assuming 1 is GDELT
                "event_type": "MILITARY_ESCALATION" if event_code == "190" else "OTHER",
                "title": f"Event at {raw.get('ActionGeo_FullName', 'Unknown')}",
                "severity_score": severity_score, # Rough proxy
                "confidence_score": 0.5, # Default for raw GDELT
                "source_url": raw.get("SOURCEURL")
            })
        return normalized
