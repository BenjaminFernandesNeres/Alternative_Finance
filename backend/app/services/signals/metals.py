from typing import Dict, Any

class GoldSignalEngine:
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        global_conflict = current_features.get("global_conflict_index", 0.0)
        me_conflict = current_features.get("conflict_intensity_7d_Middle_East", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        if global_conflict > 65.0 or me_conflict > 80.0:
            conviction = max(global_conflict, me_conflict) * 0.85 + (active_missiles * 4.0)
            msl_msg = f" Active missiles ({int(active_missiles)}) driving flight to safety." if active_missiles > 0 else ""
            return {
                "commodity": "GOLD",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"High global macro risk setting safe haven bid. Global: {global_conflict}. ME: {me_conflict}.{msl_msg}",
                "target_horizon": "1M"
            }
        return {
            "commodity": "GOLD",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Safe haven demand is moderate.",
            "target_horizon": "1M"
        }

class SilverSignalEngine:
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        global_conflict = current_features.get("global_conflict_index", 0.0)
        ind_demand = current_features.get("industrial_demand_index", 0.0)
        active_missiles = current_features.get("active_missiles", 0.0)
        
        if global_conflict > 60.0 and ind_demand > 50.0:
            conviction = (global_conflict * 0.6) + (ind_demand * 0.4) + (active_missiles * 1.5)
            msl_msg = f" Missiles risk adds {int(active_missiles)} premium." if active_missiles > 0 else ""
            return {
                "commodity": "SILVER",
                "direction": "BULLISH",
                "conviction_score": min(conviction, 100.0),
                "rationale": f"Dual tailwind from safe haven flows ({global_conflict}) and industrial demand ({ind_demand}).{msl_msg}",
                "target_horizon": "1M"
            }
        return {
            "commodity": "SILVER",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Silver market dynamics balanced.",
            "target_horizon": "1M"
        }

class PlatinumSignalEngine:
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        sa_conflict = current_features.get("conflict_intensity_7d_Africa", 0.0)
        russia_sanctions = current_features.get("sanctions_intensity_Russia", 0.0)
        
        if sa_conflict > 60.0 or russia_sanctions > 75.0:
            return {
                "commodity": "PLATINUM",
                "direction": "BULLISH",
                "conviction_score": max(sa_conflict, russia_sanctions) * 0.9,
                "rationale": f"Supply risks dominating. Africa instability ({sa_conflict}), Russia sanctions ({russia_sanctions}).",
                "target_horizon": "1M"
            }
        return {
            "commodity": "PLATINUM",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Major producer regions (SA/Russia) showing stable output vectors.",
            "target_horizon": "1M"
        }

class CopperSignalEngine:
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        macro = current_features.get("global_macro_growth", 0.0)
        sa_conflict = current_features.get("conflict_intensity_7d_South_America", 0.0)
        
        if sa_conflict > 65.0 or macro > 70.0:
            return {
                "commodity": "COPPER",
                "direction": "BULLISH",
                "conviction_score": (sa_conflict * 0.5) + (macro * 0.5),
                "rationale": f"Supply disruption in LatAm ({sa_conflict}) intersecting with global growth ({macro}).",
                "target_horizon": "1M"
            }
        elif macro < 40.0:
            return {
                "commodity": "COPPER",
                "direction": "BEARISH",
                "conviction_score": (50.0 - macro) * 2,
                "rationale": f"Weak global macro growth ({macro}) compressing industrial demand.",
                "target_horizon": "1M"
            }
        return {
            "commodity": "COPPER",
            "direction": "NEUTRAL",
            "conviction_score": 45.0,
            "rationale": "Macro environment balanced against standard supply side constraints.",
            "target_horizon": "1M"
        }

class AluminiumSignalEngine:
    def generate_signal(self, current_features: Dict[str, float]) -> Dict[str, Any]:
        macro = current_features.get("global_macro_growth", 0.0)
        energy_security = current_features.get("energy_security_premium", 0.0)
        russia_sanctions = current_features.get("sanctions_intensity_Russia", 0.0)
        
        if energy_security > 75.0 or russia_sanctions > 80.0:
            return {
                "commodity": "ALUMINIUM",
                "direction": "BULLISH",
                "conviction_score": max(energy_security, russia_sanctions) * 0.8,
                "rationale": f"High energy input costs pushing smelters offline. Energy Security: {energy_security}. Russia Sanctions: {russia_sanctions}.",
                "target_horizon": "1M"
            }
        elif macro < 40.0:
            return {
                "commodity": "ALUMINIUM",
                "direction": "BEARISH",
                "conviction_score": (50.0 - macro) * 1.5,
                "rationale": f"Weak industrial demand pulling down base metals ({macro}).",
                "target_horizon": "1M"
            }
        return {
            "commodity": "ALUMINIUM",
            "direction": "NEUTRAL",
            "conviction_score": 0.0,
            "rationale": "Power costs and demand are stable.",
            "target_horizon": "1M"
        }
