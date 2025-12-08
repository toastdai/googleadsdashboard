"""
Report Schemas - Custom reports and graphs
"""

from datetime import datetime, date
from typing import Optional, List, Literal
from uuid import UUID
from pydantic import BaseModel, Field


class ReportConfig(BaseModel):
    """Configuration for a custom report/graph."""
    x_axis: Literal["date", "hour", "device", "network", "campaign", "ad_group", "keyword"]
    y_axis_metrics: List[str] = Field(..., min_items=1, max_items=5)
    chart_type: Literal["line", "bar", "area", "combined"] = "line"
    filters: dict = {}
    date_range: dict = {}
    comparison_enabled: bool = False


class SavedReportBase(BaseModel):
    """Base saved report schema."""
    name: str = Field(..., min_length=1, max_length=255)
    chart_type: str = "line"
    config: ReportConfig
    pinned: bool = False


class SavedReportCreate(SavedReportBase):
    """Schema for creating saved report."""
    pass


class SavedReportUpdate(BaseModel):
    """Schema for updating saved report."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    chart_type: Optional[str] = None
    config: Optional[ReportConfig] = None
    pinned: Optional[bool] = None


class SavedReportResponse(SavedReportBase):
    """Saved report response schema."""
    id: UUID
    user_id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class SavedReportListResponse(BaseModel):
    """Response containing list of saved reports."""
    reports: List[SavedReportResponse]
    total: int


class ReportDataPoint(BaseModel):
    """Single data point in report."""
    label: str
    values: dict  # metric_name -> value


class ReportDataResponse(BaseModel):
    """Response containing report data."""
    report_id: UUID
    name: str
    config: ReportConfig
    data: List[ReportDataPoint]
    generated_at: datetime


class ExportRequest(BaseModel):
    """Request to export report."""
    format: Literal["png", "csv", "pdf"]
    include_header: bool = True
    filename: Optional[str] = None
