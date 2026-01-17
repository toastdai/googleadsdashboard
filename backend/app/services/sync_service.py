
import logging
import asyncio
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.services.google_ads import GoogleAdsService
from app.models.account import GoogleAdsAccount
from app.models.campaign import Campaign
from app.models.metrics import DailyMetric
from app.models.user import User

logger = logging.getLogger(__name__)

class SyncService:
    def __init__(self, db: AsyncSession, google_ads_service: GoogleAdsService):
        self.db = db
        self.google_ads_service = google_ads_service

    async def sync_all_accounts(self, manager_customer_id: str, refresh_token: str, start_date: date, end_date: date, user_id: UUID):
        """
        Syncs ALL child accounts under a manager account for the given date range.
        Creates/Updates GoogleAdsAccount, Campaigns, and DailyMetrics.
        """
        
        # 1. Fetch all child accounts
        logger.info("Fetching child accounts...")
        # Note: We need to implement a method to get child accounts in GoogleAdsService or use a direct query
        # For now, we will assume we can get them. If not, we'll need to add that method.
        # Let's use the logic we found in fetch_oct_data.py to extend the service first.
        
        # Assuming we will add get_child_accounts to GoogleAdsService
        child_accounts = await self._get_child_accounts(manager_customer_id, refresh_token)
        
        # 2. Parallel Syncing with Semaphore
        semaphore = asyncio.Semaphore(20)  # Sync 20 accounts at once (IO bound)
        
        async def sync_single_account(account_info):
            async with semaphore:
                customer_id = str(account_info['id'])
                name = account_info['name']
                
                logger.info(f"Syncing account: {name} ({customer_id})")
                
                try:
                    # Create or Update GoogleAdsAccount
                    # Note: We need a new DB session for each task if we want true parallelism interacting with DB?
                    # Actually, AsyncSession is not thread-safe but we are in asyncio single thread. 
                    # However, sharing the same session across concurrent tasks can be tricky if they all try to commit.
                    # It is safer to do the DB write operations sequentially per account or be very careful.
                    # To keep it simple and safe: We will use the shared session but ensure atomic operations?
                    # No, SQLAlchemy AsyncSession is not safe for concurrent use. 
                    # We should probably fetch data in parallel but process/save sequentially or use independent sessions.
                    
                    # Strategy: Fetch ALL data in parallel first (IO bound), then save to DB (CPU/DB bound).
                    
                    # 1. Fetch Data (Parallel IO)
                    metrics_data = await self.google_ads_service.fetch_daily_metrics(
                        customer_id=customer_id,
                        refresh_token=refresh_token,
                        start_date=start_date,
                        end_date=end_date
                    )
                    
                    return {
                        "account_info": account_info,
                        "metrics_data": metrics_data,
                        "success": True
                    }
                except Exception as e:
                    logger.error(f"Failed to fetch data for account {name}: {e}")
                    return {
                        "account_info": account_info,
                        "error": str(e),
                        "success": False
                    }

        # Run fetch tasks in parallel
        logger.info(f"Starting parallel fetch for {len(child_accounts)} accounts...")
        fetch_results = await asyncio.gather(*[sync_single_account(acc) for acc in child_accounts])
        
        # 3. Process Results Sequentially (DB operations)
        logger.info("Processing fetched data...")
        for res in fetch_results:
            if not res["success"]:
                continue
                
            account_info = res["account_info"]
            metrics_data = res["metrics_data"]
            
            customer_id = str(account_info['id'])
            name = account_info['name']
            
            # Create/Update Account
            account = await self._get_or_create_account(
                customer_id=customer_id,
                name=name,
                refresh_token=refresh_token,
                user_id=user_id,
                is_manager=False
            )
            
            # Process & Save Metrics
            await self._process_metrics(account, metrics_data)
            
            # Update last sync time
            account.last_sync_at = datetime.utcnow()
            
            # Commit per account to avoid huge transaction
            await self.db.commit()
            
        logger.info("Sync completed.")

    async def _get_child_accounts(self, manager_id: str, refresh_token: str) -> List[Dict]:
        """Temporary helper to get child accounts until we move this to GoogleAdsService."""
        # Ensure manager_id is properly formatted (10 digits, no hyphens)
        manager_id = str(manager_id).replace("-", "")
        
        client = self.google_ads_service._create_client(refresh_token)
        ga_service = client.get_service("GoogleAdsService")

        query = """
            SELECT
                customer_client.client_customer,
                customer_client.descriptive_name,
                customer_client.id,
                customer_client.manager
            FROM customer_client
            WHERE customer_client.level <= 1
            AND customer_client.status = 'ENABLED'
        """
        
        # Wrap blocking synchronous call in executor
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, lambda: list(ga_service.search(customer_id=manager_id, query=query)))
        
        accounts = []
        for row in response:
            if not row.customer_client.manager:
                accounts.append({
                    "id": row.customer_client.id,
                    "name": row.customer_client.descriptive_name or f"Account {row.customer_client.id}"
                })
        return accounts

    async def _get_or_create_account(self, customer_id: str, name: str, refresh_token: str, user_id: UUID, is_manager: bool) -> GoogleAdsAccount:
        result = await self.db.execute(
            select(GoogleAdsAccount).where(GoogleAdsAccount.customer_id == customer_id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            account = GoogleAdsAccount(
                user_id=user_id,
                customer_id=customer_id,
                name=name,
                refresh_token=refresh_token,
                is_manager=is_manager,
                is_active=True
            )
            self.db.add(account)
            await self.db.flush() # Get ID
        else:
            # Update name if changed
            if account.name != name:
                account.name = name
            # account.refresh_token = refresh_token # Optional: update token if rotated
        
        return account

    async def _get_or_create_campaign(self, account_id: UUID, google_campaign_id: str, name: str) -> Campaign:
        result = await self.db.execute(
            select(Campaign).where(
                Campaign.google_campaign_id == google_campaign_id,
                Campaign.account_id == account_id
            )
        )
        campaign = result.scalar_one_or_none()
        
        if not campaign:
            campaign = Campaign(
                account_id=account_id,
                google_campaign_id=google_campaign_id,
                name=name
            )
            self.db.add(campaign)
            await self.db.flush()
        else:
             if campaign.name != name:
                campaign.name = name
        
        return campaign

    async def _process_metrics(self, account: GoogleAdsAccount, metrics_data: List[Dict]):
        if not metrics_data:
            return

        # 1. Collect all campaign IDs and dates to pre-fetch in batches
        campaign_google_ids = {row.get("google_campaign_id") for row in metrics_data if row.get("google_campaign_id")}
        dates = {row["date"] if isinstance(row["date"], date) else datetime.strptime(row["date"], "%Y-%m-%d").date() for row in metrics_data}
        
        if not campaign_google_ids:
            return

        # 2. Batch get/create campaigns
        result = await self.db.execute(
            select(Campaign).where(
                Campaign.google_campaign_id.in_(list(campaign_google_ids)),
                Campaign.account_id == account.id
            )
        )
        existing_campaigns = {c.google_campaign_id: c for c in result.scalars().all()}
        
        # Create missing campaigns
        for row in metrics_data:
            g_id = row.get("google_campaign_id")
            name = row.get("campaign_name")
            if g_id and g_id not in existing_campaigns:
                campaign = Campaign(
                    account_id=account.id,
                    google_campaign_id=g_id,
                    name=name
                )
                self.db.add(campaign)
                existing_campaigns[g_id] = campaign
        
        # Flush to get IDs for new campaigns
        await self.db.flush()

        # 3. Batch fetch existing metrics to prevent N+1
        # Create a mapping of (campaign_id, date) -> metric
        campaign_db_ids = [c.id for c in existing_campaigns.values()]
        result = await self.db.execute(
            select(DailyMetric).where(
                DailyMetric.campaign_id.in_(campaign_db_ids),
                DailyMetric.date.in_(list(dates))
            )
        )
        existing_metrics = {(m.campaign_id, m.date): m for m in result.scalars().all()}

        # 4. Process rows
        for row in metrics_data:
            g_id = row.get("google_campaign_id")
            if not g_id:
                continue
            
            campaign = existing_campaigns.get(g_id)
            if not campaign:
                continue
                
            metric_date = row["date"]
            if isinstance(metric_date, str):
                metric_date = datetime.strptime(metric_date, "%Y-%m-%d").date()

            key = (campaign.id, metric_date)
            metric = existing_metrics.get(key)
            
            if not metric:
                metric = DailyMetric(
                    account_id=account.id,
                    campaign_id=campaign.id,
                    date=metric_date,
                    device=row.get("device", "UNSPECIFIED"),
                    network=row.get("network", "UNSPECIFIED")
                )
                self.db.add(metric)
                existing_metrics[key] = metric # Prevent duplicates in same batch
            
            # Update values
            metric.impressions = row.get("impressions", 0)
            metric.clicks = row.get("clicks", 0)
            metric.cost_micros = row.get("cost_micros", 0)
            metric.conversions = Decimal(str(row.get("conversions", 0)))
            metric.conversion_value = Decimal(str(row.get("conversion_value", 0)))
            
            # Update name if changed
            if campaign.name != row.get("campaign_name"):
                campaign.name = row.get("campaign_name")
            
            # Calculate derived
            metric.calculate_derived_metrics()

    async def sync_recent(self, manager_id: str, refresh_token: str, user_id: UUID):
        """
        Syncs data for the "gap" since the last data point, up to today.
        Limits the "catch-up" to 14 days to keep it quick (rest handled by backfill).
        Default: Yesterday and Today.
        """
        logger.info("Determining sync window for recent data...")
        
        # 1. Find the latest date we have data for
        result = await self.db.execute(select(func.max(DailyMetric.date)))
        latest_date_in_db = result.scalar()
        
        today = date.today()
        default_start = today - timedelta(days=1)  # Yesterday
        
        start_date = default_start
        
        if latest_date_in_db:
            # If we have data, start from the day AFTER the last data
            # But only if it's within reasonable limits (e.g., 14 days)
            next_day = latest_date_in_db + timedelta(days=1)
            
            days_gap = (today - next_day).days
            
            if 0 <= days_gap <= 14:
                start_date = next_day
                logger.info(f"Gap detected: {days_gap} days. Catching up from {start_date}")
            elif days_gap > 14:
                # Gap too large for "recent" sync, just do last 3 days to be safe + quick
                # Let backfill_history handle the rest
                start_date = today - timedelta(days=3)
                logger.info(f"Gap too large ({days_gap} days). Limiting recent sync to last 3 days (from {start_date}).")
            else:
                # Up to date (next_day > today), just force sync yesterday/today to ensure completeness
                 start_date = default_start
        
        # Always ensure we don't start in the future (though logic above prevents it)
        if start_date > today:
            start_date = today

        logger.info(f"Running auto-sync for {start_date} to {today}")
        await self.sync_all_accounts(manager_id, refresh_token, start_date, today, user_id)

    async def backfill_history(self, manager_id: str, refresh_token: str, user_id: UUID, days_per_run: int = 30):
        """
        Backfills historical data. 
        Finds the earliest date in DB and syncs the previous 'days_per_run' chunk.
        """
        logger.info("Running historical backfill...")
        
        # 1. Find earliest metric date in DB
        result = await self.db.execute(select(func.min(DailyMetric.date)))
        earliest_date = result.scalar()
        
        if not earliest_date:
            # If no data, start from 30 days ago
            earliest_date = date.today()
            
        start_date = earliest_date - timedelta(days=days_per_run)
        end_date = earliest_date - timedelta(days=1)
        
        # Limit backfill to a reasonable past (e.g., 2 years)
        min_allowed_date = date.today() - timedelta(days=730)
        if start_date < min_allowed_date:
            logger.info("Backfill reached limit (2 years). Stopping.")
            return

        logger.info(f"Backfilling from {start_date} to {end_date}")
        await self.sync_all_accounts(manager_id, refresh_token, start_date, end_date, user_id)

