from abc import ABC, abstractmethod
from typing import List, Dict, Any

class BaseProvider(ABC):
    """
    Abstract base class for all data ingestion providers.
    """
    def __init__(self, provider_name: str):
        self.provider_name = provider_name

    @abstractmethod
    async def fetch_raw(self, **kwargs) -> List[Dict[str, Any]]:
        """Fetch raw data from the vendor APIs or buckets."""
        pass

    @abstractmethod
    def normalize(self, raw_events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Map provider-specific fields to the canonical GeoAlpha schema."""
        pass
