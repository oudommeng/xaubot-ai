"""
Dynamic Confidence System
=========================
Adjusts the confidence threshold based on market conditions.

Principles:
- Good market (trending, good session) -> lower threshold (60%)
- Bad market (choppy, low liquidity) -> higher threshold (75%)
- Multiple confirmations -> lower threshold
"""

from dataclasses import dataclass
from typing import Optional, Tuple
from enum import Enum
from loguru import logger


class MarketQuality(Enum):
    """Market quality for trading."""
    EXCELLENT = "excellent"   # All conditions good
    GOOD = "good"            # Mostly good
    MODERATE = "moderate"    # Average
    POOR = "poor"           # Below average
    AVOID = "avoid"         # Do not trade


@dataclass
class MarketAnalysis:
    """Market analysis result."""
    quality: MarketQuality
    confidence_threshold: float
    reasons: list
    score: int  # 0-100


class DynamicConfidenceManager:
    """
    Manager that sets the confidence threshold dynamically.

    Factors considered:
    1. Session (London-NY overlap = best)
    2. Regime (medium volatility = ideal)
    3. Trend clarity (trending > ranging)
    4. SMC confluence (OB/FVG present = bonus)
    5. Spread (low = good)
    """

    def __init__(
        self,
        base_threshold: float = 0.65,
        min_threshold: float = 0.55,
        max_threshold: float = 0.80,
    ):
        self.base_threshold = base_threshold
        self.min_threshold = min_threshold
        self.max_threshold = max_threshold

        # Track last analysis for logging
        self._last_quality = "moderate"
        self._last_score = 50
        self._last_threshold = base_threshold

    def analyze_market(
        self,
        session: str,
        regime: str,
        volatility: str,
        trend_direction: str,
        has_smc_signal: bool,
        spread: float = 0,
        ml_signal: str = "",
        ml_confidence: float = 0,
    ) -> MarketAnalysis:
        """
        Analyze market conditions and pick the right threshold.

        Returns:
            MarketAnalysis with the recommended threshold
        """
        score = 50  # Start from the middle
        reasons = []

        # 1. SESSION ANALYSIS (±20 points)
        session_lower = session.lower()
        if "overlap" in session_lower or "golden" in session_lower:
            score += 20
            reasons.append("[+] Session: London-NY Overlap (best)")
        elif "london" in session_lower:
            score += 15
            reasons.append("[+] Session: London (good)")
        elif "new york" in session_lower or "ny" in session_lower:
            score += 10
            reasons.append("[+] Session: New York (good)")
        elif "asia" in session_lower or "tokyo" in session_lower:
            score += 0
            reasons.append("[!] Session: Asia (low volatility)")
        elif "closed" in session_lower or "weekend" in session_lower:
            score -= 30
            reasons.append("[X] Market closed/weekend")
        else:
            score += 5
            reasons.append(f"[i] Session: {session}")

        # 2. REGIME ANALYSIS (±15 points)
        regime_lower = regime.lower().replace(" ", "_")
        if regime_lower == "medium_volatility":
            score += 15
            reasons.append("[+] Regime: Medium volatility (ideal)")
        elif regime_lower == "low_volatility":
            score += 5
            reasons.append("[!] Regime: Low volatility (careful, ranging)")
        elif regime_lower == "high_volatility":
            score -= 5
            reasons.append("[!] Regime: High volatility (small lot!)")
        elif regime_lower == "crisis":
            score -= 25
            reasons.append("[X] Regime: Crisis (avoid trading)")

        # 3. VOLATILITY ANALYSIS (±10 points)
        vol_lower = volatility.lower()
        if vol_lower == "medium":
            score += 10
            reasons.append("[+] Volatility: Medium (ideal)")
        elif vol_lower == "low":
            score += 0
            reasons.append("[!] Volatility: Low (small moves)")
        elif vol_lower == "high":
            score -= 5
            reasons.append("[!] Volatility: High")
        elif vol_lower == "extreme":
            score -= 10
            reasons.append("[!] Volatility: Extreme (careful)")

        # 4. TREND CLARITY (±10 points)
        trend_lower = trend_direction.lower()
        if trend_lower in ["uptrend", "downtrend", "strong_up", "strong_down"]:
            score += 10
            reasons.append(f"[+] Trend: {trend_direction} (clear)")
        elif trend_lower in ["neutral", "ranging", "sideways"]:
            score -= 5
            reasons.append("[!] Trend: Ranging/sideways")

        # 5. SMC CONFLUENCE (±10 points)
        if has_smc_signal:
            score += 10
            reasons.append("[+] SMC: Confirmed (OB/FVG/BOS)")

        # 6. ML ALIGNMENT (±5 points)
        if ml_confidence >= 0.70:
            score += 5
            reasons.append(f"[+] ML: High confidence ({ml_confidence:.0%})")
        elif ml_confidence >= 0.60:
            score += 2
            reasons.append(f"[i] ML: Moderate confidence ({ml_confidence:.0%})")

        # Clamp score
        score = max(0, min(100, score))

        # Determine quality and threshold - BALANCED SETTINGS for Active Trading
        # London/NY session should have reasonable opportunity to trade
        if score >= 80:
            quality = MarketQuality.EXCELLENT
            threshold = self.min_threshold  # 60% - best conditions
        elif score >= 65:
            quality = MarketQuality.GOOD
            threshold = 0.65  # 65% - good conditions (down from 75%)
        elif score >= 50:
            quality = MarketQuality.MODERATE
            threshold = 0.70  # 70% - average conditions (down from 80%)
        elif score >= 35:
            quality = MarketQuality.POOR
            threshold = 0.80  # 80% - below-average conditions (down from 85%)
        else:
            quality = MarketQuality.AVOID
            threshold = self.max_threshold  # 85% - avoid trading

        # Track for logging
        self._last_quality = quality.value
        self._last_score = score
        self._last_threshold = threshold

        return MarketAnalysis(
            quality=quality,
            confidence_threshold=threshold,
            reasons=reasons,
            score=score,
        )

    def get_entry_decision(
        self,
        ml_confidence: float,
        analysis: MarketAnalysis,
    ) -> Tuple[bool, str]:
        """
        Decide whether entry is allowed based on the analysis.

        Returns:
            (can_entry, reason)
        """
        if analysis.quality == MarketQuality.AVOID:
            return False, f"Market quality: AVOID (score={analysis.score})"

        if ml_confidence >= analysis.confidence_threshold:
            return True, f"Entry OK: ML {ml_confidence:.0%} >= threshold {analysis.confidence_threshold:.0%} (score={analysis.score})"
        else:
            gap = analysis.confidence_threshold - ml_confidence
            return False, f"Wait: ML {ml_confidence:.0%} < threshold {analysis.confidence_threshold:.0%} (need +{gap:.0%})"

    def get_threshold_summary(self, analysis: MarketAnalysis) -> str:
        """Get summary string for logging."""
        return (
            f"Market: {analysis.quality.value.upper()} "
            f"(score={analysis.score}) -> "
            f"Threshold: {analysis.confidence_threshold:.0%}"
        )


def create_dynamic_confidence() -> DynamicConfidenceManager:
    """Create dynamic confidence manager - BALANCED (validated by backtest)."""
    return DynamicConfidenceManager(
        base_threshold=0.70,   # Default 70% - reasonable threshold
        min_threshold=0.60,    # Best conditions can go down to 60%
        max_threshold=0.85,    # Bad conditions go up to 85%
    )


if __name__ == "__main__":
    # Test
    manager = create_dynamic_confidence()

    print("=== Test 1: Ideal Conditions ===")
    analysis = manager.analyze_market(
        session="London-NY Overlap (GOLDEN)",
        regime="medium_volatility",
        volatility="medium",
        trend_direction="UPTREND",
        has_smc_signal=True,
        ml_signal="BUY",
        ml_confidence=0.68,
    )
    print(f"Quality: {analysis.quality.value}")
    print(f"Score: {analysis.score}")
    print(f"Threshold: {analysis.confidence_threshold:.0%}")
    print("Reasons:")
    for r in analysis.reasons:
        print(f"  {r}")

    can_entry, reason = manager.get_entry_decision(0.68, analysis)
    print(f"\nCan Entry (68%): {can_entry} - {reason}")

    print("\n=== Test 2: Bad Conditions ===")
    analysis2 = manager.analyze_market(
        session="Asia (low liquidity)",
        regime="low_volatility",
        volatility="low",
        trend_direction="RANGING",
        has_smc_signal=False,
        ml_signal="BUY",
        ml_confidence=0.62,
    )
    print(f"Quality: {analysis2.quality.value}")
    print(f"Score: {analysis2.score}")
    print(f"Threshold: {analysis2.confidence_threshold:.0%}")

    can_entry2, reason2 = manager.get_entry_decision(0.62, analysis2)
    print(f"\nCan Entry (62%): {can_entry2} - {reason2}")
