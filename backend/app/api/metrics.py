"""
Metrics API Routes

Raw metrics and analytics endpoints.
"""

from typing import List, Optional
from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.models.metrics import DailyMetric, HourlyMetric
from app.services.auth import get_optional_user


router = APIRouter()


@router.get("/daily")
async def get_daily_metrics(
    account_ids: Optional[List[UUID]] = Query(None),
    campaign_id: Optional[UUID] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get daily metrics for specified accounts/campaigns. No authentication required."""
    # Get account IDs - if user is logged in use their accounts, otherwise get all active accounts
    if not account_ids:
        if current_user:
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.user_id == current_user.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        else:
            # No user logged in - get ALL active accounts
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return {"data": [], "total": 0}
    
    # Build query
    query = (
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
        .group_by(DailyMetric.date)
        .order_by(DailyMetric.date)
    )
    
    if campaign_id:
        query = query.where(DailyMetric.campaign_id == campaign_id)
    
    result = await db.execute(query)
    rows = result.all()
    
    data = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        conversion_value = Decimal(row.conversion_value or 0)
        
        data.append({
            "date": row.date.isoformat(),
            "impressions": impressions,
            "clicks": clicks,
            "cost": float(cost),
            "conversions": float(conversions),
            "conversion_value": float(conversion_value),
            "ctr": float((Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else 0),
            "cpc": float((cost / Decimal(clicks)) if clicks > 0 else 0),
            "cpa": float((cost / conversions) if conversions > 0 else 0),
            "roas": float((conversion_value / cost) if cost > 0 else 0)
        })
    
    return {"data": data, "total": len(data)}


@router.get("/hourly")
async def get_hourly_metrics(
    account_ids: Optional[List[UUID]] = Query(None),
    campaign_id: Optional[UUID] = Query(None),
    target_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get hourly metrics for spike detection analysis. No authentication required."""
    # Get account IDs - if user is logged in use their accounts, otherwise get all active accounts
    if not account_ids:
        if current_user:
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.user_id == current_user.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        else:
            # No user logged in - get ALL active accounts
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return {"data": [], "total": 0}
    
    # Build query
    query = (
        select(
            HourlyMetric.hour,
            func.sum(HourlyMetric.impressions).label("impressions"),
            func.sum(HourlyMetric.clicks).label("clicks"),
            func.sum(HourlyMetric.cost_micros).label("cost_micros"),
            func.sum(HourlyMetric.conversions).label("conversions"),
        )
        .where(HourlyMetric.account_id.in_(account_ids))
        .where(HourlyMetric.date == target_date)
        .group_by(HourlyMetric.hour)
        .order_by(HourlyMetric.hour)
    )
    
    if campaign_id:
        query = query.where(HourlyMetric.campaign_id == campaign_id)
    
    result = await db.execute(query)
    rows = result.all()
    
    data = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        data.append({
            "hour": row.hour,
            "impressions": int(row.impressions or 0),
            "clicks": int(row.clicks or 0),
            "cost": float(cost),
            "conversions": float(row.conversions or 0)
        })
    
    return {"date": target_date.isoformat(), "data": data, "total": len(data)}


@router.get("/compare")
async def compare_periods(
    account_ids: Optional[List[UUID]] = Query(None),
    period1_start: date = Query(...),
    period1_end: date = Query(...),
    period2_start: date = Query(...),
    period2_end: date = Query(...),
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Compare metrics between two periods. No authentication required."""
    # Get account IDs - if user is logged in use their accounts, otherwise get all active accounts
    if not account_ids:
        if current_user:
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.user_id == current_user.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        else:
            # No user logged in - get ALL active accounts
            result = await db.execute(
                select(GoogleAdsAccount.id)
                .where(GoogleAdsAccount.is_active == True)
            )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        raise HTTPException(status_code=404, detail="No accounts found")
    
    async def get_period_metrics(start: date, end: date) -> dict:
        result = await db.execute(
            select(
                func.sum(DailyMetric.impressions).label("impressions"),
                func.sum(DailyMetric.clicks).label("clicks"),
                func.sum(DailyMetric.cost_micros).label("cost_micros"),
                func.sum(DailyMetric.conversions).label("conversions"),
                func.sum(DailyMetric.conversion_value).label("conversion_value"),
            )
            .where(DailyMetric.account_id.in_(account_ids))
            .where(DailyMetric.date >= start)
            .where(DailyMetric.date <= end)
        )
        row = result.one()
        
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        conversion_value = Decimal(row.conversion_value or 0)
        
        return {
            "impressions": impressions,
            "clicks": clicks,
            "cost": float(cost),
            "conversions": float(conversions),
            "conversion_value": float(conversion_value),
            "ctr": float((Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else 0),
            "cpc": float((cost / Decimal(clicks)) if clicks > 0 else 0),
            "cpa": float((cost / conversions) if conversions > 0 else 0),
            "roas": float((conversion_value / cost) if cost > 0 else 0)
        }
    
    period1 = await get_period_metrics(period1_start, period1_end)
    period2 = await get_period_metrics(period2_start, period2_end)
    
    # Calculate changes
    def calc_change(current, previous):
        if previous == 0:
            return 0
        return ((current - previous) / previous) * 100
    
    changes = {}
    for key in period1:
        changes[key] = calc_change(period1[key], period2[key])
    
    return {
        "period1": {
            "start": period1_start.isoformat(),
            "end": period1_end.isoformat(),
            "metrics": period1
        },
        "period2": {
            "start": period2_start.isoformat(),
            "end": period2_end.isoformat(),
            "metrics": period2
        },
        "changes": changes
    }
