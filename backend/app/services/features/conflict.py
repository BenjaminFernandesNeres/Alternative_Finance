from datetime import datetime
from typing import Dict

def aggregate_regional_conflict_score(region: str, lookback_days: int = 7) -> Dict[str, float]:
    mock_score = 0.0
    if region == "Middle East":
        mock_score = 85.5
    elif region == "Black Sea":
        mock_score = 72.0
    elif region == "South China Sea":
        mock_score = 45.0
    
    return {
        "entity_id": region,
        "feature_name": f"conflict_intensity_{lookback_days}d",
        "value": mock_score,
        "timestamp": datetime.utcnow().isoformat()
    }
