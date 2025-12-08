"""
ROI Calculator Service

Calculates ROI metrics and provides human-readable summaries.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Dict, Any


@dataclass
class ROIMetrics:
    """Calculated ROI metrics."""
    total_spend: Decimal
    total_conversions: Decimal
    total_conversion_value: Decimal
    cpa: Optional[Decimal]  # Cost per Acquisition
    roas: Optional[Decimal]  # Return on Ad Spend
    estimated_profit: Decimal
    roi_percentage: Optional[Decimal]  # (profit / spend) * 100


class ROICalculator:
    """
    Service for calculating ROI and providing insights.
    """
    
    def __init__(self, margin_percentage: Optional[Decimal] = None):
        """
        Initialize calculator with optional profit margin.
        
        Args:
            margin_percentage: Profit margin as a percentage (e.g., 30 for 30%)
                             Used to calculate estimated profit if conversion value
                             represents revenue rather than profit.
        """
        self.margin_percentage = margin_percentage
    
    def calculate(
        self,
        cost: Decimal,
        conversions: Decimal,
        conversion_value: Decimal
    ) -> ROIMetrics:
        """
        Calculate all ROI metrics.
        
        Args:
            cost: Total advertising cost
            conversions: Total number of conversions
            conversion_value: Total value of conversions
        
        Returns:
            ROIMetrics with all calculated values
        """
        # Cost per Acquisition
        cpa = (cost / conversions) if conversions > 0 else None
        
        # Return on Ad Spend
        roas = (conversion_value / cost) if cost > 0 else None
        
        # Estimated profit
        if self.margin_percentage:
            # If margin is provided, adjust conversion value
            adjusted_value = conversion_value * (self.margin_percentage / Decimal(100))
            estimated_profit = adjusted_value - cost
        else:
            # Assume conversion_value is profit
            estimated_profit = conversion_value - cost
        
        # ROI percentage
        roi_percentage = (estimated_profit / cost * 100) if cost > 0 else None
        
        return ROIMetrics(
            total_spend=cost,
            total_conversions=conversions,
            total_conversion_value=conversion_value,
            cpa=cpa,
            roas=roas,
            estimated_profit=estimated_profit,
            roi_percentage=roi_percentage
        )
    
    def generate_summary(self, metrics: ROIMetrics, currency: str = "INR") -> str:
        """
        Generate a human-readable ROI summary.
        
        Args:
            metrics: Calculated ROI metrics
            currency: Currency symbol to use
        
        Returns:
            Plain-language summary string
        """
        lines = []
        
        # Spend summary
        lines.append(f"You spent {currency} {metrics.total_spend:,.2f}")
        
        # Conversion summary
        if metrics.total_conversions > 0:
            lines.append(f"and got {int(metrics.total_conversions)} conversion(s)")
            
            if metrics.cpa:
                lines.append(f"at {currency} {metrics.cpa:,.2f} per conversion")
        else:
            lines.append("but got no conversions yet")
        
        # ROAS summary
        if metrics.roas:
            if metrics.roas >= 1:
                lines.append(f"For every 1 {currency} spent, you earned {metrics.roas:.2f} {currency} back")
            else:
                lines.append(f"For every 1 {currency} spent, you earned only {metrics.roas:.2f} {currency} back")
        
        # Profit summary
        if metrics.estimated_profit >= 0:
            lines.append(f"Estimated profit: {currency} {metrics.estimated_profit:,.2f}")
        else:
            lines.append(f"Estimated loss: {currency} {abs(metrics.estimated_profit):,.2f}")
        
        return ". ".join(lines) + "."
    
    def get_roas_status(self, roas: Decimal) -> Dict[str, Any]:
        """
        Get ROAS status with color coding.
        
        Returns:
            Dict with status, color, and recommendation
        """
        if roas >= 4:
            return {
                "status": "Excellent",
                "color": "green",
                "recommendation": "Campaign is performing very well. Consider scaling up."
            }
        elif roas >= 2:
            return {
                "status": "Good",
                "color": "green",
                "recommendation": "Campaign is profitable. Monitor and optimize further."
            }
        elif roas >= 1:
            return {
                "status": "Break-even",
                "color": "yellow",
                "recommendation": "Campaign is marginally profitable. Review targeting and bids."
            }
        else:
            return {
                "status": "Loss",
                "color": "red",
                "recommendation": "Campaign is losing money. Consider pausing or restructuring."
            }
    
    def compare_periods(
        self,
        current: ROIMetrics,
        previous: ROIMetrics
    ) -> Dict[str, Dict[str, Any]]:
        """
        Compare ROI metrics between two periods.
        
        Returns:
            Dict with change percentages and directions for each metric
        """
        def calc_change(curr: Optional[Decimal], prev: Optional[Decimal]) -> Dict[str, Any]:
            if curr is None or prev is None or prev == 0:
                return {"change": None, "direction": "flat"}
            
            change = ((curr - prev) / prev) * 100
            direction = "up" if change > 0 else "down" if change < 0 else "flat"
            return {"change": float(change), "direction": direction}
        
        return {
            "spend": calc_change(current.total_spend, previous.total_spend),
            "conversions": calc_change(current.total_conversions, previous.total_conversions),
            "conversion_value": calc_change(current.total_conversion_value, previous.total_conversion_value),
            "cpa": calc_change(current.cpa, previous.cpa),
            "roas": calc_change(current.roas, previous.roas),
            "profit": calc_change(current.estimated_profit, previous.estimated_profit)
        }
