"""
Campaigns API Routes

Campaign, Ad Group, and Keyword data endpoints.
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
from app.models.campaign import Campaign, AdGroup, Keyword
from app.models.metrics import DailyMetric
from app.schemas.dashboard import CampaignSummary
from app.services.auth import get_current_user


router = APIRouter()


@router.get("", response_model=List[CampaignSummary])
async def list_campaigns(
    account_ids: Optional[List[UUID]] = Query(None),
    status: Optional[str] = Query(None),
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all campaigns with metrics summary."""
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
    
    # Build query
    query = (
        select(
            Campaign.id,
            Campaign.google_campaign_id,
            Campaign.name,
            Campaign.status,
            Campaign.campaign_type,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
        )
        .join(DailyMetric, DailyMetric.campaign_id == Campaign.id)
        .where(Campaign.account_id.in_(account_ids))
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .where(DailyMetric.ad_group_id == None)
        .group_by(
            Campaign.id,
            Campaign.google_campaign_id,
            Campaign.name,
            Campaign.status,
            Campaign.campaign_type
        )
        .order_by(func.sum(DailyMetric.cost_micros).desc())
        .limit(limit)
    )
    
    if status:
        query = query.where(Campaign.status == status)
    
    result = await db.execute(query)
    rows = result.all()
    
    campaigns = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        conversions = Decimal(row.conversions or 0)
        
        ctr = (Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else Decimal(0)
        cpc = (cost / Decimal(clicks)) if clicks > 0 else Decimal(0)
        
        campaigns.append(CampaignSummary(
            id=row.id,
            google_campaign_id=row.google_campaign_id,
            name=row.name,
            status=row.status,
            campaign_type=row.campaign_type,
            impressions=impressions,
            clicks=clicks,
            cost=cost,
            conversions=conversions,
            ctr=ctr,
            cpc=cpc
        ))
    
    return campaigns


@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get campaign details."""
    result = await db.execute(
        select(Campaign)
        .join(GoogleAdsAccount)
        .where(Campaign.id == campaign_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {
        "id": campaign.id,
        "google_campaign_id": campaign.google_campaign_id,
        "name": campaign.name,
        "status": campaign.status,
        "campaign_type": campaign.campaign_type,
        "created_at": campaign.created_at
    }


@router.get("/{campaign_id}/ad-groups")
async def get_campaign_ad_groups(
    campaign_id: UUID,
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get ad groups for a campaign with metrics."""
    # Verify campaign access
    result = await db.execute(
        select(Campaign)
        .join(GoogleAdsAccount)
        .where(Campaign.id == campaign_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get ad groups with metrics
    result = await db.execute(
        select(
            AdGroup.id,
            AdGroup.google_adgroup_id,
            AdGroup.name,
            AdGroup.status,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
        )
        .join(DailyMetric, DailyMetric.ad_group_id == AdGroup.id)
        .where(AdGroup.campaign_id == campaign_id)
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .group_by(
            AdGroup.id,
            AdGroup.google_adgroup_id,
            AdGroup.name,
            AdGroup.status
        )
        .order_by(func.sum(DailyMetric.cost_micros).desc())
    )
    rows = result.all()
    
    ad_groups = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        clicks = int(row.clicks or 0)
        impressions = int(row.impressions or 0)
        
        ad_groups.append({
            "id": row.id,
            "google_adgroup_id": row.google_adgroup_id,
            "name": row.name,
            "status": row.status,
            "impressions": impressions,
            "clicks": clicks,
            "cost": float(cost),
            "conversions": float(row.conversions or 0),
            "ctr": float((Decimal(clicks) / Decimal(impressions) * 100) if impressions > 0 else 0),
            "cpc": float((cost / Decimal(clicks)) if clicks > 0 else 0)
        })
    
    return {"campaign_id": campaign_id, "ad_groups": ad_groups, "total": len(ad_groups)}


@router.get("/{campaign_id}/metrics")
async def get_campaign_metrics(
    campaign_id: UUID,
    start_date: date = Query(default_factory=lambda: date.today() - timedelta(days=7)),
    end_date: date = Query(default_factory=lambda: date.today() - timedelta(days=1)),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get daily metrics for a campaign."""
    # Verify campaign access
    result = await db.execute(
        select(Campaign)
        .join(GoogleAdsAccount)
        .where(Campaign.id == campaign_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    campaign = result.scalar_one_or_none()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get daily metrics
    result = await db.execute(
        select(
            DailyMetric.date,
            func.sum(DailyMetric.impressions).label("impressions"),
            func.sum(DailyMetric.clicks).label("clicks"),
            func.sum(DailyMetric.cost_micros).label("cost_micros"),
            func.sum(DailyMetric.conversions).label("conversions"),
            func.sum(DailyMetric.conversion_value).label("conversion_value"),
        )
        .where(DailyMetric.campaign_id == campaign_id)
        .where(DailyMetric.date >= start_date)
        .where(DailyMetric.date <= end_date)
        .where(DailyMetric.ad_group_id == None)
        .group_by(DailyMetric.date)
        .order_by(DailyMetric.date)
    )
    rows = result.all()
    
    metrics = []
    for row in rows:
        cost = Decimal(row.cost_micros or 0) / Decimal(1_000_000)
        metrics.append({
            "date": row.date.isoformat(),
            "impressions": int(row.impressions or 0),
            "clicks": int(row.clicks or 0),
            "cost": float(cost),
            "conversions": float(row.conversions or 0),
            "conversion_value": float(row.conversion_value or 0)
        })
    
    return {"campaign_id": campaign_id, "metrics": metrics}
