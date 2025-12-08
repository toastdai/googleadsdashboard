"""
Dashboard API Routes

Main dashboard data endpoints for KPIs, metrics, and breakdowns.
"""

from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.models.campaign import Campaign
from app.models.metrics import DailyMetric
from app.schemas.dashboard import (
    DashboardFilters,
    KPISummary,
    MetricValue,
    MetricTimeSeries,
    MetricDataPoint,
    BreakdownResponse,
    BreakdownItem,
    ROIView,
    CampaignSummary
)
from app.services.auth import get_current_user
from app.services.roi_calculator import ROICalculator


router = APIRouter()


def calculate_change(current: Decimal, previous: Decimal) -> tuple[Decimal, str]:
    """Calculate percentage change and direction."""
    if previous == 0:
        return Decimal(0), "flat"
    
    change = ((current - previous) / previous) * 100
    direction = "up" if change > 0 else "down" if change < 0 else "flat"
    return change, direction


@router.get("/summary", response_model=KPISummary)
async def get_dashboard_summary(
    account_ids: Optional[List[UUID]] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    compare: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get KPI summary for the dashboard.
    
    Returns key metrics with comparison to previous period.
    """
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        raise HTTPException(status_code=404, detail="No accounts found")
    
    # Calculate date range length for comparison period
    date_range_days = (end_date - start_date).days + 1
    compare_end = start_date - timedelta(days=1)
    compare_start = compare_end - timedelta(days=date_range_days - 1)
    
    # Query current period metrics
    current_metrics = await _aggregate_metrics(db, account_ids, start_date, end_date)
    
    # Query comparison period if enabled
    if compare:
        previous_metrics = await _aggregate_metrics(db, account_ids, compare_start, compare_end)
    else:
        previous_metrics = None
    
    # Build KPI summary
    def make_metric_value(current_val: Decimal, prev_val: Optional[Decimal]) -> MetricValue:
        if prev_val is not None:
            change, direction = calculate_change(current_val, prev_val)
            return MetricValue(
                value=current_val,
                previous_value=prev_val,
                change_percent=change,
                change_direction=direction
            )
        return MetricValue(value=current_val)
    
    prev = previous_metrics or {}
    
    # Calculate derived metrics
    cost = Decimal(current_metrics.get("cost_micros", 0)) / Decimal(1_000_000)
    prev_cost = Decimal(prev.get("cost_micros", 0)) / Decimal(1_000_000) if prev else None
    
    impressions = Decimal(current_metrics.get("impressions", 0))
    clicks = Decimal(current_metrics.get("clicks", 0))
    conversions = Decimal(current_metrics.get("conversions", 0))
    conversion_value = Decimal(current_metrics.get("conversion_value", 0))
    
    prev_impressions = Decimal(prev.get("impressions", 0)) if prev else None
    prev_clicks = Decimal(prev.get("clicks", 0)) if prev else None
    prev_conversions = Decimal(prev.get("conversions", 0)) if prev else None
    prev_conversion_value = Decimal(prev.get("conversion_value", 0)) if prev else None
    
    # CTR, CPC, CPA, ROAS
    ctr = (clicks / impressions * 100) if impressions > 0 else Decimal(0)
    cpc = (cost / clicks) if clicks > 0 else Decimal(0)
    cpa = (cost / conversions) if conversions > 0 else Decimal(0)
    roas = (conversion_value / cost) if cost > 0 else Decimal(0)
    
    prev_ctr = (prev_clicks / prev_impressions * 100) if prev_impressions and prev_impressions > 0 else None
    prev_cpc = (prev_cost / prev_clicks) if prev_clicks and prev_clicks > 0 else None
    prev_cpa = (prev_cost / prev_conversions) if prev_conversions and prev_conversions > 0 else None
    prev_roas = (prev_conversion_value / prev_cost) if prev_cost and prev_cost > 0 else None
    
    # Generate summary text
    summary_text = f"You spent {cost:.2f}, got {int(conversions)} conversions"
    if roas > 0:
        summary_text += f", with ROAS of {roas:.2f}x"
    
    return KPISummary(
        impressions=make_metric_value(impressions, prev_impressions),
        clicks=make_metric_value(clicks, prev_clicks),
        cost=make_metric_value(cost, prev_cost),
        conversions=make_metric_value(conversions, prev_conversions),
        conversion_value=make_metric_value(conversion_value, prev_conversion_value),
        ctr=make_metric_value(ctr, prev_ctr),
        cpc=make_metric_value(cpc, prev_cpc),
        cpa=make_metric_value(cpa, prev_cpa),
        roas=make_metric_value(roas, prev_roas),
        summary_text=summary_text
    )


async def _aggregate_metrics(
    db: AsyncSession,
    account_ids: List[UUID],
    start_date: date,
    end_date: date
) -> dict:
    """Aggregate metrics for given accounts and date range."""
    result = await db.execute(
        select(
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .where(DailyMetric.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .where(DailyMetric.campaign_id != None)  # Campaign-level aggregation
        .where(DailyMetric.ad_group_id == None)  # Exclude ad group level
    )
    row = result.one()
    
    return {
        "impressions": row.impressions or 0,
        "clicks": row.clicks or 0,
        "cost_micros": row.cost_micros or 0,
        "conversions": row.conversions or 0,
        "conversion_value": row.conversion_value or 0,
    }


@router.get("/metrics", response_model=List[MetricTimeSeries])
async def get_metrics_timeseries(
    metrics: List[str] = Query(["impressions", "clicks", "cost"]),
    account_ids: Optional[List[UUID]] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get time series data for specified metrics."""
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return []
    
    # Query daily metrics
    result = await db.execute(
        select(
            DailyMetric.date,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .where(DailyMetric.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .where(DailyMetric.campaign_id != None)
        .where(DailyMetric.ad_group_id == None)
        .group_by(DailyMetric.date)
        .order_by(DailyMetric.date)
    )
    rows = result.all()
    
    # Build time series for each metric
    time_series_list = []
    
    metric_mapping = {
        "impressions": "impressions",
        "clicks": "clicks",
        "cost": "cost_micros",
        "conversions": "conversions",
        "conversion_value": "conversion_value",
    }
    
    for metric in metrics:
        if metric not in metric_mapping:
            continue
        
        data_points = []
        total = Decimal(0)
        
        for row in rows:
            value = getattr(row, metric_mapping[metric]) or 0
            if metric == "cost":
                value = Decimal(value) / Decimal(1_000_000)
            else:
                value = Decimal(value)
            
            data_points.append(MetricDataPoint(
                date=row.date,
                value=value
            ))
            total += value
        
        avg = total / len(data_points) if data_points else Decimal(0)
        
        time_series_list.append(MetricTimeSeries(
            metric=metric,
            data=data_points,
            total=total,
            average=avg
        ))
    
    return time_series_list


@router.get("/breakdown/{dimension}", response_model=BreakdownResponse)
async def get_breakdown(
    dimension: str,
    account_ids: Optional[List[UUID]] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    limit: int = Query(default=10, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get breakdown of metrics by dimension.
    
    Supported dimensions: campaign, device, network
    """
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return BreakdownResponse(dimension=dimension, items=[], total_items=0)
    
    if dimension == "campaign":
        return await _get_campaign_breakdown(db, account_ids, start_date, end_date, limit)
    elif dimension == "device":
        return await _get_device_breakdown(db, account_ids, start_date, end_date)
    elif dimension == "network":
        return await _get_network_breakdown(db, account_ids, start_date, end_date)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported dimension: {dimension}")


async def _get_campaign_breakdown(
    db: AsyncSession,
    account_ids: List[UUID],
    start_date: date,
    end_date: date,
    limit: int
) -> BreakdownResponse:
    """Get metrics breakdown by campaign."""
    result = await db.execute(
        select(
            Campaign.id,
            Campaign.name,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .join(DailyMetric, DailyMetric.campaign_id == Campaign.id)
        .where(DailyMetric.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .where(DailyMetric.ad_group_id == None)
        .group_by(Campaign.id, Campaign.name)
        .order_by(func.sum(DailyMetric.cost_micros).desc())
        .limit(limit)
    )
    rows = result.all()
    
    # Calculate total cost for share calculation
    total_cost = sum(Decimal(row.cost_micros or 0) for row in rows)
    
    items = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        conversion_value = Decimal(row.conversion_value or 0)
        
        ctr = (Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else Decimal(0)
        cpc = (cost / Decimal(clicks)) if clicks > 0 else Decimal(0)
        cpa = (cost / conversions) if conversions > 0 else None
        roas = (conversion_value / cost) if cost > 0 else None
        share = (Decimal(row.cost_micros or 0) / total_cost * 100) if total_cost > 0 else Decimal(0)
        
        items.append(BreakdownItem(
            id=row.id,
            name=row.name,
            impressions=impressions,
            clicks=clicks,
            cost=cost,
            conversions=conversions,
            conversion_value=conversion_value,
            ctr=ctr,
            cpc=cpc,
            cpa=cpa,
            roas=roas,
            share_of_total=share
        ))
    
    return BreakdownResponse(
        dimension="campaign",
        items=items,
        total_items=len(items)
    )


async def _get_device_breakdown(
    db: AsyncSession,
    account_ids: List[UUID],
    start_date: date,
    end_date: date
) -> BreakdownResponse:
    """Get metrics breakdown by device."""
    result = await db.execute(
        select(
            DailyMetric.device,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .where(DailyMetric.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .group_by(DailyMetric.device)
        .order_by(func.sum(DailyMetric.cost_micros).desc())
    )
    rows = result.all()
    
    total_cost = sum(Decimal(row.cost_micros or 0) for row in rows)
    
    items = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        conversion_value = Decimal(row.conversion_value or 0)
        
        ctr = (Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else Decimal(0)
        cpc = (cost / Decimal(clicks)) if clicks > 0 else Decimal(0)
        share = (Decimal(row.cost_micros or 0) / total_cost * 100) if total_cost > 0 else Decimal(0)
        
        items.append(BreakdownItem(
            name=row.device or "Unknown",
            impressions=impressions,
            clicks=clicks,
            cost=cost,
            conversions=conversions,
            conversion_value=conversion_value,
            ctr=ctr,
            cpc=cpc,
            share_of_total=share
        ))
    
    return BreakdownResponse(
        dimension="device",
        items=items,
        total_items=len(items)
    )


async def _get_network_breakdown(
    db: AsyncSession,
    account_ids: List[UUID],
    start_date: date,
    end_date: date
) -> BreakdownResponse:
    """Get metrics breakdown by network."""
    result = await db.execute(
        select(
            DailyMetric.network,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .where(DailyMetric.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .group_by(DailyMetric.network)
        .order_by(func.sum(DailyMetric.cost_micros).desc())
    )
    rows = result.all()
    
    total_cost = sum(Decimal(row.cost_micros or 0) for row in rows)
    
    items = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        conversion_value = Decimal(row.conversion_value or 0)
        
        ctr = (Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else Decimal(0)
        cpc = (cost / Decimal(clicks)) if clicks > 0 else Decimal(0)
        share = (Decimal(row.cost_micros or 0) / total_cost * 100) if total_cost > 0 else Decimal(0)
        
        items.append(BreakdownItem(
            name=row.network or "Unknown",
            impressions=impressions,
            clicks=clicks,
            cost=cost,
            conversions=conversions,
            conversion_value=conversion_value,
            ctr=ctr,
            cpc=cpc,
            share_of_total=share
        ))
    
    return BreakdownResponse(
        dimension="network",
        items=items,
        total_items=len(items)
    )


@router.get("/roi", response_model=ROIView)
async def get_roi_summary(
    account_ids: Optional[List[UUID]] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get ROI summary view."""
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        raise HTTPException(status_code=404, detail="No accounts found")
    
    metrics = await _aggregate_metrics(db, account_ids, start_date, end_date)
    
    cost = Decimal(metrics.get("cost_micros", 0)) / Decimal(1_000_000)
    conversions = Decimal(metrics.get("conversions", 0))
    conversion_value = Decimal(metrics.get("conversion_value", 0))
    
    roas = (conversion_value / cost) if cost > 0 else Decimal(0)
    profit = conversion_value - cost
    
    # Generate human-readable ROAS text
    roas_text = f"For every 1 rupee spent, you earned {roas:.2f} back" if roas > 0 else "No return data available"
    
    return ROIView(
        total_spend=cost,
        total_conversions=conversions,
        total_conversion_value=conversion_value,
        roas=roas,
        estimated_profit=profit,
        roas_text=roas_text
    )
