"""
Data Sync Tasks

Background tasks for syncing data from Google Ads API.
"""

from datetime import date, timedelta, datetime
from typing import Optional
import asyncio

from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.config import settings
from app.database import get_async_database_url
from app.models.account import GoogleAdsAccount
from app.models.campaign import Campaign, AdGroup
from app.models.metrics import DailyMetric, HourlyMetric
from app.models.alerts import SyncLog
from app.services.google_ads import GoogleAdsService


def get_async_session():
    """Create a new async session for background tasks."""
    engine = create_async_engine(
        get_async_database_url(settings.database_url),
        echo=False
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def trigger_account_sync(self, account_id: str, full_sync: bool = False):
    """
    Trigger data sync for an account.
    
    Args:
        account_id: UUID of the Google Ads account
        full_sync: If True, sync last 90 days. Otherwise, sync last 7 days.
    """
    try:
        asyncio.run(_sync_account(account_id, full_sync))
    except Exception as e:
        raise self.retry(exc=e)


async def _sync_account(account_id: str, full_sync: bool = False):
    """Async implementation of account sync."""
    async_session = get_async_session()
    
    async with async_session() as db:
        try:
            # Get account
            result = await db.execute(
                select(GoogleAdsAccount).where(GoogleAdsAccount.id == account_id)
            )
            account = result.scalar_one_or_none()
            
            if not account:
                return
            
            # Create sync log
            sync_log = SyncLog(
                account_id=account.id,
                sync_type="FULL" if full_sync else "INCREMENTAL",
                status="RUNNING",
                details={}
            )
            db.add(sync_log)
            await db.flush()
            
            # Determine date range
            end_date = date.today() - timedelta(days=1)
            if full_sync:
                start_date = end_date - timedelta(days=90)
            else:
                start_date = end_date - timedelta(days=7)
            
            # Initialize Google Ads service
            google_ads = GoogleAdsService()
            
            # Sync campaigns
            campaigns = await google_ads.fetch_campaigns(
                account.customer_id,
                account.refresh_token
            )
            
            for campaign_data in campaigns:
                # Check if campaign exists
                result = await db.execute(
                    select(Campaign).where(
                        Campaign.google_campaign_id == campaign_data["google_campaign_id"]
                    )
                )
                campaign = result.scalar_one_or_none()
                
                if campaign:
                    # Update
                    campaign.name = campaign_data["name"]
                    campaign.status = campaign_data["status"]
                    campaign.campaign_type = campaign_data["campaign_type"]
                else:
                    # Create
                    campaign = Campaign(
                        account_id=account.id,
                        google_campaign_id=campaign_data["google_campaign_id"],
                        name=campaign_data["name"],
                        status=campaign_data["status"],
                        campaign_type=campaign_data["campaign_type"]
                    )
                    db.add(campaign)
            
            await db.flush()
            
            # Build campaign ID mapping
            result = await db.execute(
                select(Campaign).where(Campaign.account_id == account.id)
            )
            campaigns_db = result.scalars().all()
            campaign_map = {c.google_campaign_id: c.id for c in campaigns_db}
            
            # Sync daily metrics
            metrics = await google_ads.fetch_daily_metrics(
                account.customer_id,
                account.refresh_token,
                start_date,
                end_date
            )
            
            for metric_data in metrics:
                campaign_id = campaign_map.get(metric_data["google_campaign_id"])
                if not campaign_id:
                    continue
                
                metric_date = datetime.strptime(metric_data["date"], "%Y-%m-%d").date()
                
                # Check if metric exists
                result = await db.execute(
                    select(DailyMetric).where(
                        DailyMetric.account_id == account.id,
                        DailyMetric.campaign_id == campaign_id,
                        DailyMetric.date == metric_date,
                        DailyMetric.device == metric_data["device"],
                        DailyMetric.network == metric_data["network"],
                        DailyMetric.ad_group_id == None
                    )
                )
                metric = result.scalar_one_or_none()
                
                if metric:
                    # Update
                    metric.impressions = metric_data["impressions"]
                    metric.clicks = metric_data["clicks"]
                    metric.cost_micros = metric_data["cost_micros"]
                    metric.conversions = metric_data["conversions"]
                    metric.conversion_value = metric_data["conversion_value"]
                    metric.calculate_derived_metrics()
                else:
                    # Create
                    metric = DailyMetric(
                        account_id=account.id,
                        campaign_id=campaign_id,
                        date=metric_date,
                        device=metric_data["device"],
                        network=metric_data["network"],
                        impressions=metric_data["impressions"],
                        clicks=metric_data["clicks"],
                        cost_micros=metric_data["cost_micros"],
                        conversions=metric_data["conversions"],
                        conversion_value=metric_data["conversion_value"]
                    )
                    metric.calculate_derived_metrics()
                    db.add(metric)
            
            # Update account last sync time
            account.last_sync_at = datetime.utcnow()
            
            # Update sync log
            sync_log.status = "COMPLETED"
            sync_log.completed_at = datetime.utcnow()
            sync_log.details = {
                "campaigns_synced": len(campaigns),
                "metrics_synced": len(metrics),
                "date_range": f"{start_date} to {end_date}"
            }
            
            await db.commit()
            
        except Exception as e:
            await db.rollback()
            
            # Update sync log with error
            if sync_log:
                sync_log.status = "FAILED"
                sync_log.completed_at = datetime.utcnow()
                sync_log.details = {"error": str(e)}
                await db.commit()
            
            raise


@shared_task
def sync_all_accounts():
    """Scheduled task to sync all active accounts."""
    asyncio.run(_sync_all_accounts())


async def _sync_all_accounts():
    """Async implementation to sync all accounts."""
    async_session = get_async_session()
    
    async with async_session() as db:
        result = await db.execute(
            select(GoogleAdsAccount)
            .where(GoogleAdsAccount.is_active == True)
        )
        accounts = result.scalars().all()
        
        for account in accounts:
            # Trigger individual sync tasks
            trigger_account_sync.delay(str(account.id), full_sync=False)


# Exported function for sync task
sync_account_data = trigger_account_sync
