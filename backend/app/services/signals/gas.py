from typing import Dict, Any

class GasSignalEngine:
    """
    Rule-based signal engine for Natural Gas (e.g., European TTF, US Henry Hub).
    """
    
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        """
        Evaluate current factor features and emit a signal for Natural Gas.
        
        Requires features:
        - conflict_intensity_7d_Black_Sea
        - sanctions_intensity_Russia
        - conflict_intensity_7d_Middle_East
        """
        black_sea_conflict = current_features.get("conflict_intensity_7d_Black_Sea", 0.0)
        russia_sanctions = current_features.get("sanctions_intensity_Russia", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        # Simple logical rules for MVP
        if black_sea_conflict > 70.0 or russia_sanctions > 80.0:
            conviction = max(black_sea_conflict, russia_sanctions) * 0.8 + (active_missiles * 2.0)
            msl_msg = f" Also {int(active_missiles)} active missile threats." if active_missiles > 0 else ""
            return {
                "commodity": "NATURAL_GAS",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"High risk in European supply chains: Black Sea conflict ({black_sea_conflict}), Russia sanctions ({russia_sanctions}).{msl_msg}",
                "target_horizon": "1W"
            }
        elif black_sea_conflict < 40.0 and russia_sanctions < 40.0:
             return {
                "commodity": "NATURAL_GAS",
                "direction": "BEARISH",
                "conviction_score": 60.0,
                "rationale": "Stable supply routes in Europe and lack of new sanctions.",
                "target_horizon": "1M"
            }
            
        return {
            "commodity": "NATURAL_GAS",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Geopolitical risk factors for Gas are within normal bounds.",
            "target_horizon": "1W"
        }
