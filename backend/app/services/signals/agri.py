from typing import Dict, Any

class WheatSignalEngine:
    """
    Rule-based signal engine for Wheat.
    """
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        black_sea = current_features.get("conflict_intensity_7d_Black_Sea", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        if black_sea > 60.0:
            conviction = (black_sea * 1.1) + (active_missiles * 3.0)
            msl_msg = f" Missiles explicitly threatened ({int(active_missiles)})." if active_missiles > 0 else ""
            return {
                "commodity": "WHEAT",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"Elevated Black Sea conflict ({black_sea}) threatening primary export routes.{msl_msg}",
                "target_horizon": "2W"
            }
        return {
            "commodity": "WHEAT",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Black Sea export routes operating normally.",
            "target_horizon": "1W"
        }

class CornSignalEngine:
    """
    Rule-based signal engine for Corn.
    """
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        black_sea = current_features.get("conflict_intensity_7d_Black_Sea", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        if black_sea > 65.0:
            conviction = (black_sea * 0.9) + (active_missiles * 2.5)
            msl_msg = f" Also {int(active_missiles)} active missile alerts." if active_missiles > 0 else ""
            return {
                "commodity": "CORN",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0), 
                "rationale": f"Spillover supply risks from Black Sea conflict ({black_sea}).{msl_msg}",
                "target_horizon": "2W"
            }
        return {
            "commodity": "CORN",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Corn supply routes operating normally.",
            "target_horizon": "1W"
        }
