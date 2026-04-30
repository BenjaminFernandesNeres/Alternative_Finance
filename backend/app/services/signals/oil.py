from typing import Dict, Any

class OilSignalEngine:
    """
    Rule-based signal engine for BRENT and WTI Crude.
    """
    
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        """
        Evaluate current factor features and emit a signal if thresholds are crossed.
        
        Requires features:
        - conflict_intensity_7d_Middle_East
        - shipping_disruption_Hormuz
        - sanctions_intensity_Russia
        """
        me_conflict = current_features.get("conflict_intensity_7d_Middle_East", 0.0)
        hormuz_risk = current_features.get("shipping_disruption_Hormuz", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        # Simple logical rules for MVP
        if me_conflict > 80.0 and hormuz_risk > 70.0:
            conviction = (me_conflict * 0.6) + (hormuz_risk * 0.4) + (active_missiles * 2.5)
            rationale_suffix = f" Active missiles ({int(active_missiles)}) escalating threat." if active_missiles > 0 else ""
            return {
                "commodity": "BRENT",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"Severe Middle East conflict ({me_conflict}) combined with Hormuz shipping risks ({hormuz_risk}).{rationale_suffix}",
                "target_horizon": "1W"
            }
        elif me_conflict < 30.0 and hormuz_risk < 30.0:
             return {
                "commodity": "BRENT",
                "direction": "BEARISH",
                "conviction_score": 55.0,
                "rationale": "De-escalation in key choke points and low regional conflict.",
                "target_horizon": "1M"
            }
            
        return {
            "commodity": "BRENT",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Geopolitical risk factors are within normal historical bounds.",
            "target_horizon": "1W"
        }
