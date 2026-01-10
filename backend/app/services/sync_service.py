
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
        
        for account_info in child_accounts:
            customer_id = str(account_info['id'])
            name = account_info['name']
            
            logger.info(f"Syncing account: {name} ({customer_id})")
            
            # 2. Create or Update GoogleAdsAccount
            account = await self._get_or_create_account(
                customer_id=customer_id,
                name=name,
                refresh_token=refresh_token, # Using same refresh token for now as it's a manager account
                user_id=user_id,
                is_manager=False
            )
            
            # 3. Fetch Data for this account
            try:
                metrics_data = await self.google_ads_service.fetch_daily_metrics(
                    customer_id=customer_id,
                    refresh_token=refresh_token,
                    start_date=start_date,
                    end_date=end_date
                )
                
                # 4. Process Metrics
                await self._process_metrics(account, metrics_data)
                
                # Update last sync time
                account.last_sync_at = datetime.utcnow()
                await self.db.commit()
                
            except Exception as e:
                logger.error(f"Failed to sync account {name}: {e}")
                # Continue to next account
                continue

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
        
        # This is a synchronous call, might want to wrap in run_in_executor if blocking loop
        response = ga_service.search(customer_id=manager_id, query=query)
        
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
        for row in metrics_data:
            # Get/Create Campaign
            # Note: We depend on fetch_daily_metrics to return google_campaign_id and campaign_name
            campaign_id_str = row.get("google_campaign_id")
            campaign_name = row.get("campaign_name")
            
            if not campaign_id_str:
                continue

            campaign = await self._get_or_create_campaign(account.id, campaign_id_str, campaign_name)
            
            # Check if metric exists
            metric_date = row["date"] # Assuming date object or string
            if isinstance(metric_date, str):
                metric_date = datetime.strptime(metric_date, "%Y-%m-%d").date()

            # We can use an UPSERT strategy or check-then-insert.
            # For simplicity, check-then-insert/update
            result = await self.db.execute(
                select(DailyMetric).where(
                    DailyMetric.campaign_id == campaign.id,
                    DailyMetric.date == metric_date
                )
            )
            metric = result.scalar_one_or_none()
            
            if not metric:
                metric = DailyMetric(
                    account_id=account.id,
                    campaign_id=campaign.id,
                    date=metric_date,
                    device=row.get("device", "UNSPECIFIED"),
                    network=row.get("network", "UNSPECIFIED")
                )
                self.db.add(metric)
            
            # Update values
            metric.impressions = row.get("impressions", 0)
            metric.clicks = row.get("clicks", 0)
            metric.cost_micros = row.get("cost_micros", 0)
            metric.conversions = Decimal(row.get("conversions", 0))
            metric.conversion_value = Decimal(row.get("conversion_value", 0))
            
            # Calculate derived
            metric.calculate_derived_metrics()

    async def sync_recent(self, manager_id: str, refresh_token: str, user_id: UUID):
        """Syncs data for yesterday and today to ensure up-to-date metrics."""
        today = date.today()
        yesterday = today - timedelta(days=1)
        
        logger.info(f"Running auto-sync for {yesterday} to {today}")
        await self.sync_all_accounts(manager_id, refresh_token, yesterday, today, user_id)

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

