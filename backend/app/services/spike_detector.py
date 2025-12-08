"""
Spike Detection Engine

Anomaly detection algorithms for Google Ads metrics.
Uses rolling z-score and percentage change thresholds.
"""

from dataclasses import dataclass
from datetime import datetime, date
from typing import List, Optional, Dict, Any, Tuple
from decimal import Decimal
from enum import Enum
import numpy as np


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertType(str, Enum):
    """Types of anomaly alerts."""
    POSITIVE_SPIKE = "POSITIVE_SPIKE"  # Good metrics increased significantly
    NEGATIVE_SPIKE = "NEGATIVE_SPIKE"  # Bad metrics increased or good decreased
    VOLUME_ANOMALY = "VOLUME_ANOMALY"  # Sudden drop in impressions/clicks


@dataclass
class SpikeAlert:
    """Detected spike/anomaly alert."""
    metric: str
    alert_type: AlertType
    severity: AlertSeverity
    current_value: float
    previous_value: float
    z_score: float
    percent_change: float
    message: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    detected_at: datetime = None
    
    def __post_init__(self):
        if self.detected_at is None:
            self.detected_at = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "metric": self.metric,
            "alert_type": self.alert_type.value,
            "severity": self.severity.value,
            "current_value": self.current_value,
            "previous_value": self.previous_value,
            "z_score": self.z_score,
            "percent_change": self.percent_change,
            "message": self.message,
            "campaign_id": self.campaign_id,
            "campaign_name": self.campaign_name,
            "detected_at": self.detected_at.isoformat()
        }


@dataclass
class DetectionConfig:
    """Configuration for spike detection thresholds."""
    # Z-score thresholds
    z_score_warning: float = 2.5
    z_score_critical: float = 3.5
    
    # Percentage change thresholds
    percent_warning: float = 30.0
    percent_critical: float = 50.0
    
    # Absolute thresholds (optional, in currency units)
    cost_absolute_warning: Optional[float] = None
    cost_absolute_critical: Optional[float] = None
    
    # Minimum data points required for detection
    min_data_points: int = 7
    
    # Historical window size
    window_size: int = 7


class SpikeDetector:
    """
    Spike detection engine using statistical anomaly detection.
    
    Methods:
    - Rolling Z-Score: Compares current value to rolling mean/std
    - Percentage Change: Compares to previous period
    - Volume Anomaly: Detects sudden drops in traffic
    """
    
    # Metrics where increase is positive (good)
    POSITIVE_METRICS = {"conversions", "conversion_value", "roas", "ctr", "clicks", "impressions"}
    
    # Metrics where increase is negative (bad)
    NEGATIVE_METRICS = {"cost", "cpa", "cpc"}
    
    def __init__(self, config: Optional[DetectionConfig] = None):
        self.config = config or DetectionConfig()
    
    def detect_spikes(
        self,
        metric_name: str,
        current_value: float,
        historical_values: List[float],
        campaign_id: Optional[str] = None,
        campaign_name: Optional[str] = None
    ) -> Optional[SpikeAlert]:
        """
        Detect if current value represents a spike/anomaly.
        
        Args:
            metric_name: Name of the metric (e.g., 'cost', 'conversions')
            current_value: Current period value
            historical_values: List of historical values (most recent last)
            campaign_id: Optional campaign ID for context
            campaign_name: Optional campaign name for message
        
        Returns:
            SpikeAlert if anomaly detected, None otherwise
        """
        if len(historical_values) < self.config.min_data_points:
            return None
        
        # Calculate statistics
        z_score = self._calculate_z_score(current_value, historical_values)
        percent_change = self._calculate_percent_change(current_value, historical_values[-1])
        
        # Determine if this is a spike
        alert = self._evaluate_spike(
            metric_name=metric_name,
            current_value=current_value,
            previous_value=historical_values[-1],
            z_score=z_score,
            percent_change=percent_change,
            campaign_id=campaign_id,
            campaign_name=campaign_name
        )
        
        return alert
    
    def detect_volume_anomaly(
        self,
        impressions: float,
        historical_impressions: List[float],
        campaign_id: Optional[str] = None,
        campaign_name: Optional[str] = None
    ) -> Optional[SpikeAlert]:
        """
        Detect sudden drops in impression volume (potential delivery issues).
        """
        if len(historical_impressions) < self.config.min_data_points:
            return None
        
        avg_impressions = np.mean(historical_impressions[-self.config.window_size:])
        
        if avg_impressions == 0:
            return None
        
        percent_change = ((impressions - avg_impressions) / avg_impressions) * 100
        
        # Volume anomaly is when impressions drop significantly
        if percent_change < -50:  # More than 50% drop
            severity = AlertSeverity.CRITICAL
            message = (
                f"Impression volume dropped {abs(percent_change):.1f}% "
                f"({int(impressions)} vs avg {int(avg_impressions)})"
            )
            if campaign_name:
                message = f"Campaign '{campaign_name}': {message}"
            
            return SpikeAlert(
                metric="impressions",
                alert_type=AlertType.VOLUME_ANOMALY,
                severity=severity,
                current_value=impressions,
                previous_value=avg_impressions,
                z_score=self._calculate_z_score(impressions, historical_impressions),
                percent_change=percent_change,
                message=message,
                campaign_id=campaign_id,
                campaign_name=campaign_name
            )
        
        return None
    
    def analyze_metrics_batch(
        self,
        metrics: Dict[str, float],
        historical_metrics: Dict[str, List[float]],
        campaign_id: Optional[str] = None,
        campaign_name: Optional[str] = None
    ) -> List[SpikeAlert]:
        """
        Analyze multiple metrics at once and return all detected alerts.
        """
        alerts = []
        
        for metric_name, current_value in metrics.items():
            if metric_name not in historical_metrics:
                continue
            
            historical = historical_metrics[metric_name]
            
            # Check for spike
            alert = self.detect_spikes(
                metric_name=metric_name,
                current_value=current_value,
                historical_values=historical,
                campaign_id=campaign_id,
                campaign_name=campaign_name
            )
            
            if alert:
                alerts.append(alert)
        
        # Also check for volume anomaly if impressions are available
        if "impressions" in metrics and "impressions" in historical_metrics:
            volume_alert = self.detect_volume_anomaly(
                impressions=metrics["impressions"],
                historical_impressions=historical_metrics["impressions"],
                campaign_id=campaign_id,
                campaign_name=campaign_name
            )
            if volume_alert:
                alerts.append(volume_alert)
        
        return alerts
    
    def _calculate_z_score(self, value: float, historical: List[float]) -> float:
        """Calculate z-score of value against historical data."""
        if len(historical) == 0:
            return 0.0
        
        window = historical[-self.config.window_size:]
        mean = np.mean(window)
        std = np.std(window)
        
        if std == 0:
            return 0.0
        
        return (value - mean) / std
    
    def _calculate_percent_change(self, current: float, previous: float) -> float:
        """Calculate percentage change between current and previous value."""
        if previous == 0:
            return 0.0 if current == 0 else 100.0
        
        return ((current - previous) / previous) * 100
    
    def _evaluate_spike(
        self,
        metric_name: str,
        current_value: float,
        previous_value: float,
        z_score: float,
        percent_change: float,
        campaign_id: Optional[str],
        campaign_name: Optional[str]
    ) -> Optional[SpikeAlert]:
        """Evaluate if the change represents a significant spike."""
        
        abs_z = abs(z_score)
        abs_pct = abs(percent_change)
        
        # Determine severity based on z-score and percent change
        if abs_z >= self.config.z_score_critical or abs_pct >= self.config.percent_critical:
            severity = AlertSeverity.CRITICAL
        elif abs_z >= self.config.z_score_warning or abs_pct >= self.config.percent_warning:
            severity = AlertSeverity.WARNING
        else:
            return None  # Not significant enough
        
        # Determine alert type based on metric and direction
        is_positive_metric = metric_name.lower() in self.POSITIVE_METRICS
        is_increase = percent_change > 0
        
        if is_positive_metric:
            if is_increase:
                alert_type = AlertType.POSITIVE_SPIKE
                direction = "increased"
            else:
                alert_type = AlertType.NEGATIVE_SPIKE
                direction = "decreased"
        else:  # Negative metric (cost, cpa)
            if is_increase:
                alert_type = AlertType.NEGATIVE_SPIKE
                direction = "increased"
            else:
                alert_type = AlertType.POSITIVE_SPIKE
                direction = "decreased"
        
        # Generate message
        message = (
            f"{metric_name.upper()} {direction} by {abs(percent_change):.1f}% "
            f"({previous_value:.2f} -> {current_value:.2f})"
        )
        if campaign_name:
            message = f"Campaign '{campaign_name}': {message}"
        
        return SpikeAlert(
            metric=metric_name,
            alert_type=alert_type,
            severity=severity,
            current_value=current_value,
            previous_value=previous_value,
            z_score=z_score,
            percent_change=percent_change,
            message=message,
            campaign_id=campaign_id,
            campaign_name=campaign_name
        )


def create_default_detector() -> SpikeDetector:
    """Create a spike detector with sensible defaults."""
    return SpikeDetector(DetectionConfig(
        z_score_warning=2.5,
        z_score_critical=3.5,
        percent_warning=30.0,
        percent_critical=50.0,
        min_data_points=7,
        window_size=7
    ))
