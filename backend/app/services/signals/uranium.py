from typing import Dict, Any

class UraniumSignalEngine:
    """
    Rule-based signal engine for Uranium.
    """
    
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        """
        Evaluate current factor features and emit a signal for Uranium.
        
        Requires features:
        - sanctions_intensity_Russia
        - energy_security_premium
        """
        russia_sanctions = current_features.get("sanctions_intensity_Russia", 0.0)
        energy_security = current_features.get("energy_security_premium", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        # Simple logical rules for MVP
        if russia_sanctions > 70.0 or energy_security > 75.0:
            conviction = (russia_sanctions * 0.5) + (energy_security * 0.5) + (active_missiles * 1.5)
            msl_msg = f" Missiles augmenting global tension ({int(active_missiles)})." if active_missiles > 0 else ""
            return {
                "commodity": "URANIUM",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"High energy security premium ({energy_security}) and Russian sanctions ({russia_sanctions}) driving nuclear fuel demand.{msl_msg}",
                "target_horizon": "1M"
            }
        elif russia_sanctions < 40.0 and energy_security < 40.0:
             return {
                "commodity": "URANIUM",
                "direction": "BEARISH",
                "conviction_score": 50.0,
                "rationale": "Low supply chain risk for nuclear fuel.",
                "target_horizon": "3M"
            }
            
        return {
            
            "commodity": "URANIUM",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Uranium supply dynamics are stable.",
            "target_horizon": "1M"
        }
