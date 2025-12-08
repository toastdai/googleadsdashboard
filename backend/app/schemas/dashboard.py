"""
Dashboard Schemas - KPIs, metrics, and breakdowns
"""

from datetime import date, datetime
from typing import Optional, List, Literal
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class DashboardFilters(BaseModel):
    """Filters for dashboard data."""
    account_ids: Optional[List[UUID]] = None
    campaign_ids: Optional[List[UUID]] = None
    start_date: date
    end_date: date
    compare_start_date: Optional[date] = None
    compare_end_date: Optional[date] = None
    device: Optional[str] = None
    network: Optional[str] = None
    status: Optional[str] = None


class MetricValue(BaseModel):
    """Single metric value with comparison."""
    value: Decimal
    previous_value: Optional[Decimal] = None
    change_percent: Optional[Decimal] = None
    change_direction: Optional[Literal["up", "down", "flat"]] = None


class KPISummary(BaseModel):
    """Dashboard KPI summary."""
    impressions: MetricValue
    clicks: MetricValue
    cost: MetricValue
    conversions: MetricValue
    conversion_value: MetricValue
    ctr: MetricValue
    cpc: MetricValue
    cpa: MetricValue
    roas: MetricValue
    
    # Human-readable summary
    summary_text: str = ""


class MetricDataPoint(BaseModel):
    """Single data point in a time series."""
    date: date
    value: Decimal
    previous_value: Optional[Decimal] = None


class MetricTimeSeries(BaseModel):
    """Time series data for a metric."""
    metric: str
    data: List[MetricDataPoint]
    total: Decimal
    average: Decimal


class BreakdownItem(BaseModel):
    """Single breakdown item (campaign, device, etc.)."""
    id: Optional[UUID] = None
    name: str
    impressions: int
    clicks: int
    cost: Decimal
    conversions: Decimal
    conversion_value: Decimal
    ctr: Decimal
    cpc: Decimal
    cpa: Optional[Decimal] = None
    roas: Optional[Decimal] = None
    share_of_total: Decimal = Field(default=0, description="Percentage of total spend")


class BreakdownResponse(BaseModel):
    """Breakdown response with multiple items."""
    dimension: str
    items: List[BreakdownItem]
    total_items: int


class CampaignSummary(BaseModel):
    """Campaign summary for dashboard."""
    id: UUID
    google_campaign_id: str
    name: str
    status: str
    campaign_type: str
    impressions: int
    clicks: int
    cost: Decimal
    conversions: Decimal
    ctr: Decimal
    cpc: Decimal
    roas: Optional[Decimal] = None
    
    class Config:
        from_attributes = True


class ROIView(BaseModel):
    """ROI summary view."""
    total_spend: Decimal
    total_conversions: Decimal
    total_conversion_value: Decimal
    roas: Decimal
    estimated_profit: Decimal
    roas_text: str = ""  # "For every 1 rupee spent, you earned X back"
