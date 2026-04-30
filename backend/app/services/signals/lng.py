from typing import Dict, Any

class LngSignalEngine:
    """
    Rule-based signal engine for Liquefied Natural Gas (LNG).
    """
    
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        """
        Evaluate current factor features and emit a signal for LNG.
        
        Requires features:
        - shipping_disruption_Hormuz
        - conflict_intensity_7d_South_China_Sea
        """
        hormuz_risk = current_features.get("shipping_disruption_Hormuz", 0.0)
        scs_conflict = current_features.get("conflict_intensity_7d_South_China_Sea", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        # Simple logical rules for MVP
        if hormuz_risk > 75.0 or scs_conflict > 60.0:
            conviction = (hormuz_risk * 0.7) + (scs_conflict * 0.3) + (active_missiles * 2.0)
            msl_msg = f" Missiles detected: {int(active_missiles)}." if active_missiles > 0 else ""
            return {
                "commodity": "LNG",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"Major shipping disruption risks. Hormuz: {hormuz_risk}, South China Sea: {scs_conflict}.{msl_msg}",
                "target_horizon": "2W"
            }
        elif hormuz_risk <= 40.0 and scs_conflict <= 40.0:
             return {
                "commodity": "LNG",
                "direction": "BEARISH",
                "conviction_score": 50.0,
                "rationale": "Clear shipping lanes for global LNG transit.",
                "target_horizon": "1M"
            }
            
        return {
            "commodity": "LNG",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "LNG transit risks are moderate.",
            "target_horizon": "1W"
        }
