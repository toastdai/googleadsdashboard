"""
Spike Detection Service for Campaign Metrics
"""
import os
import json
import logging
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from dataclasses import dataclass
from pathlib import Path

from .whatsapp import get_whatsapp_service

logger = logging.getLogger(__name__)

# File to store previous metrics for comparison
METRICS_CACHE_FILE = Path("/tmp/tellspike_metrics_cache.json")


@dataclass
class MetricChange:
    """Represents a change in a metric."""
    network: str
    metric_name: str
    current_value: float
    previous_value: float
    change_percent: float
    direction: str  # "up" or "down"
    is_spike: bool


class SpikeDetector:
    """Detects spikes in campaign metrics from partner APIs."""
    
    def __init__(self, spike_threshold_percent: float = None):
        """
        Initialize the spike detector.
        
        Args:
            spike_threshold_percent: Percentage change to consider as spike (default from env or 20%)
        """
        self.threshold = spike_threshold_percent or float(os.getenv("SPIKE_THRESHOLD_PERCENT", "20"))
        self.frontend_url = os.getenv("FRONTEND_URL", "https://googleadsdashboard-beta.vercel.app")
        self.previous_metrics = self._load_previous_metrics()
    
    def _load_previous_metrics(self) -> Dict[str, Any]:
        """Load previous metrics from cache file."""
        try:
            if METRICS_CACHE_FILE.exists():
                with open(METRICS_CACHE_FILE, "r") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load previous metrics: {e}")
        return {}
    
    def _save_metrics(self, metrics: Dict[str, Any]):
        """Save current metrics to cache file."""
        try:
            metrics["timestamp"] = datetime.now().isoformat()
            with open(METRICS_CACHE_FILE, "w") as f:
                json.dump(metrics, f)
        except Exception as e:
            logger.error(f"Failed to save metrics: {e}")
    
    async def fetch_kelkoo_data(self) -> Optional[Dict[str, Any]]:
        """Fetch current Kelkoo data from the frontend API."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.frontend_url}/api/kelkoo")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return data.get("data", {})
        except Exception as e:
            logger.error(f"Failed to fetch Kelkoo data: {e}")
        return None
    
    async def fetch_admedia_data(self) -> Optional[Dict[str, Any]]:
        """Fetch current Admedia data from the frontend API."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.frontend_url}/api/admedia")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return data.get("data", {})
        except Exception as e:
            logger.error(f"Failed to fetch Admedia data: {e}")
        return None
    
    async def fetch_maxbounty_data(self) -> Optional[Dict[str, Any]]:
        """Fetch current MaxBounty data from the frontend API."""
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(f"{self.frontend_url}/api/maxbounty")
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        return data.get("data", {})
        except Exception as e:
            logger.error(f"Failed to fetch MaxBounty data: {e}")
        return None
    
    def _calculate_change(
        self,
        network: str,
        metric_name: str,
        current: float,
        previous: float
    ) -> MetricChange:
        """Calculate the change between current and previous values."""
        if previous == 0:
            change_percent = 100.0 if current > 0 else 0.0
        else:
            change_percent = ((current - previous) / previous) * 100
        
        direction = "up" if change_percent > 0 else "down"
        is_spike = abs(change_percent) >= self.threshold
        
        return MetricChange(
            network=network,
            metric_name=metric_name,
            current_value=current,
            previous_value=previous,
            change_percent=change_percent,
            direction=direction,
            is_spike=is_spike
        )
    
    async def check_for_spikes(self) -> List[MetricChange]:
        """
        Check all partner APIs for metric spikes.
        
        Returns:
            List of MetricChange objects for all spikes detected
        """
        spikes: List[MetricChange] = []
        current_metrics: Dict[str, Any] = {}
        
        # Fetch Kelkoo data
        kelkoo = await self.fetch_kelkoo_data()
        if kelkoo:
            current_metrics["kelkoo"] = kelkoo
            prev_kelkoo = self.previous_metrics.get("kelkoo", {})
            
            # Check leads
            if "leadCount" in kelkoo:
                change = self._calculate_change(
                    "Kelkoo",
                    "Leads",
                    kelkoo.get("leadCount", 0),
                    prev_kelkoo.get("leadCount", kelkoo.get("leadCount", 0))
                )
                if change.is_spike:
                    spikes.append(change)
            
            # Check revenue
            if "leadEstimatedRevenueInEur" in kelkoo:
                change = self._calculate_change(
                    "Kelkoo",
                    "Revenue (EUR)",
                    kelkoo.get("leadEstimatedRevenueInEur", 0),
                    prev_kelkoo.get("leadEstimatedRevenueInEur", kelkoo.get("leadEstimatedRevenueInEur", 0))
                )
                if change.is_spike:
                    spikes.append(change)
        
        # Fetch Admedia data
        admedia = await self.fetch_admedia_data()
        if admedia:
            current_metrics["admedia"] = admedia
            prev_admedia = self.previous_metrics.get("admedia", {})
            
            # Check leads
            if "leads" in admedia:
                change = self._calculate_change(
                    "Admedia",
                    "Leads",
                    admedia.get("leads", 0),
                    prev_admedia.get("leads", admedia.get("leads", 0))
                )
                if change.is_spike:
                    spikes.append(change)
            
            # Check earnings
            if "earnings" in admedia:
                change = self._calculate_change(
                    "Admedia",
                    "Earnings (USD)",
                    admedia.get("earnings", 0),
                    prev_admedia.get("earnings", admedia.get("earnings", 0))
                )
                if change.is_spike:
                    spikes.append(change)
        
        # Fetch MaxBounty data
        maxbounty = await self.fetch_maxbounty_data()
        if maxbounty:
            current_metrics["maxbounty"] = maxbounty
            prev_maxbounty = self.previous_metrics.get("maxbounty", {})
            
            # Check leads
            if "leads" in maxbounty:
                change = self._calculate_change(
                    "MaxBounty",
                    "Leads",
                    maxbounty.get("leads", 0),
                    prev_maxbounty.get("leads", maxbounty.get("leads", 0))
                )
                if change.is_spike:
                    spikes.append(change)
            
            # Check earnings
            if "earnings" in maxbounty:
                change = self._calculate_change(
                    "MaxBounty",
                    "Earnings (USD)",
                    maxbounty.get("earnings", 0),
                    prev_maxbounty.get("earnings", maxbounty.get("earnings", 0))
                )
                if change.is_spike:
                    spikes.append(change)
        
        # Save current metrics for next comparison
        self._save_metrics(current_metrics)
        
        return spikes
    
    async def check_and_alert(self) -> Dict[str, Any]:
        """
        Check for spikes and send WhatsApp alerts.
        
        Returns:
            dict with check results
        """
        spikes = await self.check_for_spikes()
        
        if not spikes:
            return {
                "spikes_detected": 0,
                "alerts_sent": 0,
                "message": "No spikes detected"
            }
        
        # Send WhatsApp alerts for each spike
        whatsapp = get_whatsapp_service()
        alerts_sent = 0
        alert_results = []
        
        for spike in spikes:
            result = whatsapp.send_spike_alert(
                metric_name=spike.metric_name,
                network=spike.network,
                current_value=spike.current_value,
                previous_value=spike.previous_value,
                change_percent=spike.change_percent,
                direction=spike.direction
            )
            
            if result.get("success"):
                alerts_sent += 1
            
            alert_results.append({
                "network": spike.network,
                "metric": spike.metric_name,
                "change_percent": spike.change_percent,
                "alert_sent": result.get("success", False),
                "error": result.get("error")
            })
        
        return {
            "spikes_detected": len(spikes),
            "alerts_sent": alerts_sent,
            "threshold_percent": self.threshold,
            "details": alert_results
        }


# Singleton instance
_spike_detector: Optional[SpikeDetector] = None


def get_spike_detector() -> SpikeDetector:
    """Get the singleton spike detector instance."""
    global _spike_detector
    if _spike_detector is None:
        _spike_detector = SpikeDetector()
    return _spike_detector
