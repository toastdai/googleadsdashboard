"""
Alert Processing Tasks

Background tasks for spike detection and alert generation.
"""

from datetime import date, timedelta, datetime
from typing import List
import asyncio

from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, func

from app.config import settings
from app.database import get_async_database_url
from app.models.account import GoogleAdsAccount
from app.models.campaign import Campaign
from app.models.metrics import DailyMetric
from app.models.alerts import Alert, AlertSetting
from app.services.spike_detector import SpikeDetector, DetectionConfig


def get_async_session():
    """Create a new async session for background tasks."""
    engine = create_async_engine(
        get_async_database_url(settings.database_url),
        echo=False
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task
def run_spike_detection(account_id: str = None):
    """
    Run spike detection for account(s).
    
    Args:
        account_id: Optional specific account ID. If None, runs for all accounts.
    """
    asyncio.run(_run_spike_detection(account_id))


async def _run_spike_detection(account_id: str = None):
    """Async implementation of spike detection."""
    async_session = get_async_session()
    
    async with async_session() as db:
        # Get accounts to process
        query = select(GoogleAdsAccount).where(GoogleAdsAccount.is_active == True)
        if account_id:
            query = query.where(GoogleAdsAccount.id == account_id)
        
        result = await db.execute(query)
        accounts = result.scalars().all()
        
        detector = SpikeDetector()
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        for account in accounts:
            # Get user's alert settings
            result = await db.execute(
                select(AlertSetting)
                .where(AlertSetting.user_id == account.user_id)
                .where(AlertSetting.enabled == True)
            )
            alert_settings = result.scalars().all()
            
            if not alert_settings:
                # Use default settings
                alert_settings = None
            
            # Get campaigns for this account
            result = await db.execute(
                select(Campaign).where(Campaign.account_id == account.id)
            )
            campaigns = result.scalars().all()
            
            for campaign in campaigns:
                # Get historical metrics (last 14 days)
                result = await db.execute(
                    select(
                        DailyMetric.date,
                        func.sum(DailyMetric.impressions).label("impressions"),
                        func.sum(DailyMetric.clicks).label("clicks"),
                        func.sum(DailyMetric.cost_micros).label("cost_micros"),
                        func.sum(DailyMetric.conversions).label("conversions"),
                    )
                    .where(DailyMetric.campaign_id == campaign.id)
                    .where(DailyMetric.date >= today - timedelta(days=14))
                    .where(DailyMetric.date <= yesterday)
                    .where(DailyMetric.ad_group_id == None)
                    .group_by(DailyMetric.date)
                    .order_by(DailyMetric.date)
                )
                rows = result.all()
                
                if len(rows) < 7:
                    # Not enough data for detection
                    continue
                
                # Get yesterday's metrics (current period)
                current_row = next((r for r in rows if r.date == yesterday), None)
                if not current_row:
                    continue
                
                # Build historical data
                historical = [r for r in rows if r.date != yesterday]
                
                # Prepare metrics for detection
                current_metrics = {
                    "impressions": float(current_row.impressions or 0),
                    "clicks": float(current_row.clicks or 0),
                    "cost": float((current_row.cost_micros or 0) / 1_000_000),
                    "conversions": float(current_row.conversions or 0)
                }
                
                historical_metrics = {
                    "impressions": [float(r.impressions or 0) for r in historical],
                    "clicks": [float(r.clicks or 0) for r in historical],
                    "cost": [float((r.cost_micros or 0) / 1_000_000) for r in historical],
                    "conversions": [float(r.conversions or 0) for r in historical]
                }
                
                # Calculate derived metrics
                for i, row in enumerate(historical):
                    impr = float(row.impressions or 0)
                    clicks = float(row.clicks or 0)
                    cost = float((row.cost_micros or 0) / 1_000_000)
                    conv = float(row.conversions or 0)
                    
                    if "ctr" not in historical_metrics:
                        historical_metrics["ctr"] = []
                        historical_metrics["cpc"] = []
                        historical_metrics["cpa"] = []
                    
                    historical_metrics["ctr"].append((clicks / impr * 100) if impr > 0 else 0)
                    historical_metrics["cpc"].append((cost / clicks) if clicks > 0 else 0)
                    historical_metrics["cpa"].append((cost / conv) if conv > 0 else 0)
                
                # Add current derived metrics
                impr = current_metrics["impressions"]
                clicks = current_metrics["clicks"]
                cost = current_metrics["cost"]
                conv = current_metrics["conversions"]
                
                current_metrics["ctr"] = (clicks / impr * 100) if impr > 0 else 0
                current_metrics["cpc"] = (cost / clicks) if clicks > 0 else 0
                current_metrics["cpa"] = (cost / conv) if conv > 0 else 0
                
                # Run detection
                alerts = detector.analyze_metrics_batch(
                    metrics=current_metrics,
                    historical_metrics=historical_metrics,
                    campaign_id=str(campaign.id),
                    campaign_name=campaign.name
                )
                
                # Save alerts
                for spike_alert in alerts:
                    alert = Alert(
                        account_id=account.id,
                        campaign_id=campaign.id,
                        metric=spike_alert.metric,
                        alert_type=spike_alert.alert_type.value,
                        severity=spike_alert.severity.value,
                        message=spike_alert.message,
                        context=spike_alert.to_dict(),
                        is_read=False,
                        is_notified=False,
                        detected_at=spike_alert.detected_at
                    )
                    db.add(alert)
        
        await db.commit()


@shared_task
def process_alerts():
    """Process unnotified alerts and send notifications."""
    asyncio.run(_process_alerts())


async def _process_alerts():
    """Async implementation of alert processing."""
    async_session = get_async_session()
    
    async with async_session() as db:
        # Get unnotified alerts
        result = await db.execute(
            select(Alert)
            .where(Alert.is_notified == False)
            .order_by(Alert.detected_at.desc())
            .limit(100)
        )
        alerts = result.scalars().all()
        
        # Group by account for batch notification
        from collections import defaultdict
        alerts_by_account = defaultdict(list)
        
        for alert in alerts:
            alerts_by_account[alert.account_id].append(alert)
        
        # Import notification task
        from app.tasks.notifications import send_notification
        
        # Trigger notifications
        for account_id, account_alerts in alerts_by_account.items():
            for alert in account_alerts:
                send_notification.delay(str(alert.id))
                alert.is_notified = True
        
        await db.commit()
