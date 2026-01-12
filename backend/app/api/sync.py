"""
Manual Sync API Endpoint

Trigger Google Ads data sync manually.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.services.google_ads import GoogleAdsService
from app.services.sync_service import SyncService
from app.services.auth import get_current_user
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.config import settings


router = APIRouter()


async def cache_live_data_to_db(
    start_date: str,
    end_date: str,
    all_campaigns: dict,
    daily_totals: dict,
    campaign_daily_data: list,
    child_accounts: list,
    refresh_token: str
):
    """
    Background task to cache live-fetched Google Ads data into the database.
    This enables faster subsequent loads for the same date range.
    """
    from app.database import async_session_maker
    from app.models.campaign import Campaign
    from app.models.metrics import DailyMetric
    from decimal import Decimal
    from datetime import datetime
    
    try:
        async with async_session_maker() as db:
            # Get the first active account to link data
            result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.is_active == True)
                .limit(1)
            )
            account = result.scalar_one_or_none()
            
            if not account:
                print("CACHE: No active account found, skipping cache")
                return
            
            # Cache campaigns and their metrics
            for campaign_id, camp_data in all_campaigns.items():
                # Check if campaign exists
                result = await db.execute(
                    select(Campaign)
                    .where(Campaign.google_campaign_id == str(campaign_id))
                    .limit(1)
                )
                campaign = result.scalar_one_or_none()
                
                if not campaign:
                    # Create campaign
                    campaign = Campaign(
                        google_campaign_id=str(campaign_id),
                        account_id=account.id,
                        name=camp_data["name"],
                        status="ENABLED",
                        campaign_type="UNKNOWN"
                    )
                    db.add(campaign)
                    await db.flush()
            
            # 2. Cache campaign-level daily metrics
            # Group by (date, campaign_id) to handle duplicates if any (though unlikely with Google Ads API structure)
            
            # Map campaign Google IDs to DB IDs
            campaign_map = {} # google_id -> db_id
            
            # Re-fetch campaigns to get their IDs
            result = await db.execute(
                select(Campaign).where(Campaign.account_id == account.id)
            )
            campaigns_db = result.scalars().all()
            for c in campaigns_db:
                campaign_map[c.google_campaign_id] = c.id
            
            # Process granular data
            for row in campaign_daily_data:
                c_google_id = str(row["campaign_id"])
                if c_google_id not in campaign_map:
                    continue # Should not happen as we created them above
                
                c_db_id = campaign_map[c_google_id]
                metric_date = datetime.strptime(row["date"], "%Y-%m-%d").date() if isinstance(row["date"], str) else row["date"]
                
                # Upsert metric
                result = await db.execute(
                    select(DailyMetric)
                    .where(DailyMetric.account_id == account.id)
                    .where(DailyMetric.campaign_id == c_db_id)
                    .where(DailyMetric.date == metric_date)
                    .limit(1)
                )
                metric = result.scalar_one_or_none()
                
                cost_micros = int(row["cost"] * 1000000)
                
                if not metric:
                    metric = DailyMetric(
                        account_id=account.id,
                        campaign_id=c_db_id,
                        date=metric_date,
                        impressions=row["impressions"],
                        clicks=row["clicks"],
                        cost_micros=cost_micros,
                        conversions=Decimal(str(row["conversions"]))
                    )
                    db.add(metric)
                else:
                    metric.impressions = row["impressions"]
                    metric.clicks = row["clicks"]
                    metric.cost_micros = cost_micros
                    metric.conversions = Decimal(str(row["conversions"]))

            # 3. Cache Account-level daily totals (campaign_id = None)
            # This is useful for quick account-wide aggregation
            for date_str, day_data in daily_totals.items():
                metric_date = datetime.strptime(date_str, "%Y-%m-%d").date() if isinstance(date_str, str) else date_str
                
                result = await db.execute(
                    select(DailyMetric)
                    .where(DailyMetric.account_id == account.id)
                    .where(DailyMetric.campaign_id == None)
                    .where(DailyMetric.date == metric_date)
                    .limit(1)
                )
                metric = result.scalar_one_or_none()
                
                cost_micros = int(day_data["cost"] * 1000000)
                
                if not metric:
                    metric = DailyMetric(
                        account_id=account.id,
                        campaign_id=None,
                        date=metric_date,
                        impressions=day_data["impressions"],
                        clicks=day_data["clicks"],
                        cost_micros=cost_micros,
                        conversions=Decimal(str(day_data["conversions"]))
                    )
                    db.add(metric)
                else:
                    metric.impressions = day_data["impressions"]
                    metric.clicks = day_data["clicks"]
                    metric.cost_micros = cost_micros
                    metric.conversions = Decimal(str(day_data["conversions"]))
            
            await db.commit()
            print(f"CACHE: Successfully cached data for {start_date} to {end_date} ({len(all_campaigns)} campaigns, {len(daily_totals)} days)")
            
    except Exception as e:
        print(f"CACHE ERROR: Failed to cache live data: {str(e)}")
        import traceback
        traceback.print_exc()


@router.post("/sync/trigger")
async def trigger_manual_sync(
    days: int = Query(default=30, description="Number of days to sync"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Trigger manual Google Ads data sync.
    
    Args:
        days: Number of days to sync (default 30)
        
    Returns:
        Sync status and summary
    """
    try:
        # Calculate date range
        end_date = date.today() - timedelta(days=1)
        start_date = end_date - timedelta(days=days)
        
        # Initialize services
        google_ads_service = GoogleAdsService()
        sync_service = SyncService(db, google_ads_service)
        
        # Get user's Google Ads account (try manager first, then any account)
        print(f"DEBUG Sync: Looking for manager account for user {current_user.email} (id={current_user.id})")
        result = await db.execute(
            select(GoogleAdsAccount)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_manager == True)
            .limit(1)
        )
        manager_account = result.scalar_one_or_none()
        
        if not manager_account:
            # No manager account found, try to get any account
            print(f"DEBUG Sync: No manager account found, looking for any account")
            result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.user_id == current_user.id)
                .where(GoogleAdsAccount.is_active == True)
                .limit(1)
            )
            manager_account = result.scalar_one_or_none()
        
        if not manager_account:
            # Check if user has any accounts at all
            all_accounts_result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.user_id == current_user.id)
            )
            all_accounts = all_accounts_result.scalars().all()
            print(f"DEBUG Sync: User has {len(all_accounts)} total accounts")
            for acc in all_accounts:
                print(f"DEBUG Sync: Account {acc.customer_id} - is_manager={acc.is_manager}, is_active={acc.is_active}")
            
            raise HTTPException(
                status_code=400,
                detail=f"No Google Ads account found. Please sign out and sign in again. (Found {len(all_accounts)} accounts in database)"
            )
        
        # Use the account's customer ID and refresh token
        account_customer_id = manager_account.customer_id
        refresh_token = manager_account.refresh_token
        
        # If account is not a manager, use login_customer_id from settings as manager
        if manager_account.is_manager:
            manager_id = account_customer_id
            print(f"DEBUG Sync: Using manager account {manager_id}")
        else:
            # This is a child account, use settings login_customer_id as manager
            manager_id = settings.google_ads_login_customer_id
            if not manager_id:
                raise HTTPException(
                    status_code=400,
                    detail="Your account is not a manager account. Please configure GOOGLE_ADS_LOGIN_CUSTOMER_ID in backend settings."
                )
            print(f"DEBUG Sync: Using child account {account_customer_id} with manager {manager_id}")
        
        # Debug logging
        print(f"DEBUG: Manager ID = {manager_id}, Account ID = {account_customer_id}")
        print(f"DEBUG: Refresh token exists = {bool(refresh_token)}")
        
        # Ensure manager_id is properly formatted (10 digits, no hyphens)
        manager_id = str(manager_id).replace("-", "")
        
        # Run sync
        await sync_service.sync_all_accounts(
            manager_customer_id=manager_id,
            refresh_token=refresh_token,
            start_date=start_date,
            end_date=end_date,
            user_id=current_user.id
        )
        
        return {
            "status": "success",
            "message": f"Synced {days} days of data",
            "date_range": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sync failed: {str(e)}"
        )


@router.get("/sync/fetch-live")
async def fetch_live_data(
    start_date: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end_date: str = Query(..., description="End date (YYYY-MM-DD)"),
    cache: bool = Query(default=True, description="Cache fetched data in database"),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch Google Ads data LIVE from API for any date range.
    This endpoint fetches directly from Google Ads API without requiring authentication.
    Used for on-demand historical data fetching.
    Data is automatically cached in the database for faster subsequent loads.
    """
    from decimal import Decimal
    
    try:
        # Parse dates
        start = date.fromisoformat(start_date)
        end = date.fromisoformat(end_date)
        
        # Validate date range (max 365 days to prevent abuse)
        if (end - start).days > 365:
            raise HTTPException(status_code=400, detail="Date range cannot exceed 365 days")
        
        # Get any account with refresh token from database
        result = await db.execute(
            select(GoogleAdsAccount)
            .where(GoogleAdsAccount.is_active == True)
            .where(GoogleAdsAccount.refresh_token.isnot(None))
            .limit(1)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            # Try to use settings refresh token
            if not settings.google_ads_refresh_token:
                raise HTTPException(
                    status_code=400,
                    detail="No Google Ads account configured. Please sign in first."
                )
            refresh_token = settings.google_ads_refresh_token
            manager_id = settings.google_ads_login_customer_id
        else:
            refresh_token = account.refresh_token
            # Find manager account
            manager_result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.is_manager == True)
                .where(GoogleAdsAccount.is_active == True)
                .limit(1)
            )
            manager = manager_result.scalar_one_or_none()
            manager_id = manager.customer_id if manager else settings.google_ads_login_customer_id
        
        if not manager_id:
            raise HTTPException(status_code=400, detail="No manager account ID configured")
        
        # Initialize services
        google_ads_service = GoogleAdsService()
        sync_service = SyncService(db, google_ads_service)
        
        # Fetch child accounts
        child_accounts = await sync_service._get_child_accounts(manager_id, refresh_token)
        
        if not child_accounts:
            raise HTTPException(status_code=400, detail="No child accounts found under manager")
        
        # Aggregate metrics from all accounts
        all_campaigns = {}
        daily_totals = {}
        campaign_daily_data = []
        total_metrics = {
            "impressions": 0,
            "clicks": 0,
            "cost": Decimal("0"),
            "conversions": Decimal("0"),
            "conversion_value": Decimal("0")
        }
        
        # Helper function for parallel processing
        async def fetch_account_metrics(account_info):
            customer_id = str(account_info['id'])
            account_name = account_info.get('name', f"Account {customer_id}")
            try:
                # This is now non-blocking thanks to run_in_executor in service
                metrics_data = await google_ads_service.fetch_daily_metrics(
                    customer_id=customer_id,
                    refresh_token=refresh_token,
                    start_date=start,
                    end_date=end
                )
                # Inject account name into each metric row so we can aggregate later
                for row in metrics_data:
                    row['account_name'] = account_name
                    
                return metrics_data
            except Exception as e:
                print(f"Error fetching account {customer_id}: {e}")
                return []

        # Run all fetches in parallel
        # We can use a semaphore if there are too many accounts to avoid hitting rate limits
        # Google Ads API has high limits, but 10-20 concurrent requests is safe
        semaphore = asyncio.Semaphore(10)
        
        async def safe_fetch(acc):
            async with semaphore:
                return await fetch_account_metrics(acc)

        results_list = await asyncio.gather(*[safe_fetch(acc) for acc in child_accounts])
        
        # Process results sequentially to aggregate (CPU bound, fast)
        for metrics_data in results_list:
            for row in metrics_data:
                campaign_id = row['google_campaign_id']
                campaign_name = row['campaign_name']
                account_name = row.get('account_name', 'Unknown')
                row_date = row['date']
                
                # Cost is in micros (divide by 1,000,000)
                cost = Decimal(str(row['cost_micros'])) / Decimal("1000000")
                impressions = row['impressions']
                clicks = row['clicks']
                conversions = Decimal(str(row['conversions']))
                conversion_value = Decimal(str(row['conversion_value']))
                
                # Aggregate by campaign
                if campaign_id not in all_campaigns:
                    all_campaigns[campaign_id] = {
                        "google_campaign_id": campaign_id,
                        "name": campaign_name,
                        "account_name": account_name,
                        "impressions": 0,
                        "clicks": 0,
                        "cost": Decimal("0"),
                        "conversions": Decimal("0"),
                        "conversion_value": Decimal("0")
                    }
                
                all_campaigns[campaign_id]["impressions"] += impressions
                all_campaigns[campaign_id]["clicks"] += clicks
                all_campaigns[campaign_id]["cost"] += cost
                all_campaigns[campaign_id]["conversions"] += conversions
                all_campaigns[campaign_id]["conversions"] += conversions
                all_campaigns[campaign_id]["conversion_value"] += conversion_value
                
                # Store granular data for caching
                campaign_daily_data.append({
                    "date": row_date,
                    "campaign_id": campaign_id,
                    "impressions": impressions,
                    "clicks": clicks,
                    "cost": cost,
                    "conversions": conversions
                })
                
                # Aggregate by date
                if row_date not in daily_totals:
                    daily_totals[row_date] = {
                        "date": row_date,
                        "impressions": 0,
                        "clicks": 0,
                        "cost": Decimal("0"),
                        "conversions": Decimal("0")
                    }
                
                daily_totals[row_date]["impressions"] += impressions
                daily_totals[row_date]["clicks"] += clicks
                daily_totals[row_date]["cost"] += cost
                daily_totals[row_date]["conversions"] += conversions
                
                # Grand totals
                total_metrics["impressions"] += impressions
                total_metrics["clicks"] += clicks
                total_metrics["cost"] += cost
                total_metrics["conversions"] += conversions
                total_metrics["conversion_value"] += conversion_value
        
        # Calculate derived metrics
        ctr = (total_metrics["clicks"] / total_metrics["impressions"] * 100) if total_metrics["impressions"] > 0 else 0
        cpc = (total_metrics["cost"] / total_metrics["clicks"]) if total_metrics["clicks"] > 0 else 0
        cpa = (total_metrics["cost"] / total_metrics["conversions"]) if total_metrics["conversions"] > 0 else 0
        roas = (total_metrics["conversion_value"] / total_metrics["cost"]) if total_metrics["cost"] > 0 else 0
        
        # Format campaigns with CTR/CPC
        formatted_campaigns = []
        for c in all_campaigns.values():
            campaign_ctr = (c["clicks"] / c["impressions"] * 100) if c["impressions"] > 0 else 0
            campaign_cpc = (c["cost"] / c["clicks"]) if c["clicks"] > 0 else 0
            formatted_campaigns.append({
                "google_campaign_id": c["google_campaign_id"],
                "name": c["name"],
                "impressions": c["impressions"],
                "clicks": c["clicks"],
                "cost": str(c["cost"]),
                "conversions": str(c["conversions"]),
                "conversion_value": str(c["conversion_value"]),
                "ctr": str(campaign_ctr),
                "cpc": str(campaign_cpc)
            })
        
        # Sort campaigns by cost descending
        formatted_campaigns.sort(key=lambda x: float(x["cost"]), reverse=True)
        
        # Format daily data for charts
        daily_data = sorted(daily_totals.values(), key=lambda x: x["date"])
        formatted_daily = [{
            "date": d["date"],
            "impressions": d["impressions"],
            "clicks": d["clicks"],
            "cost": str(d["cost"]),
            "conversions": str(d["conversions"])
        } for d in daily_data]
        
        response_data = {
            "success": True,
            "source": "live_api",
            "cached": False,
            "date_range": {
                "start": start_date,
                "end": end_date
            },
            "summary": {
                "impressions": total_metrics["impressions"],
                "clicks": total_metrics["clicks"],
                "cost": str(total_metrics["cost"]),
                "conversions": str(total_metrics["conversions"]),
                "conversion_value": str(total_metrics["conversion_value"]),
                "ctr": str(ctr),
                "cpc": str(cpc),
                "cpa": str(cpa),
                "roas": str(roas)
            },
            "campaigns": formatted_campaigns,
            "daily_metrics": formatted_daily,
            "accounts_synced": len(child_accounts)
        }
        
        # Cache data in database in background if enabled
        if cache and background_tasks:
            background_tasks.add_task(
                cache_live_data_to_db,
                start_date,
                end_date,
                all_campaigns,
                daily_totals,
                campaign_daily_data,
                child_accounts,
                refresh_token
            )
            response_data["cached"] = True
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch live data: {str(e)}"
        )


@router.get("/sync/status")
async def get_sync_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get last sync status and statistics."""
    from sqlalchemy import select, func
    from app.models.alerts import SyncLog
    from app.models.metrics import DailyMetric
    
    # Get last sync log
    result = await db.execute(
        select(SyncLog)
        .order_by(SyncLog.created_at.desc())
        .limit(1)
    )
    last_sync = result.scalar_one_or_none()
    
    # Get total metrics count
    metrics_result = await db.execute(
        select(func.count(DailyMetric.id))
    )
    metrics_count = metrics_result.scalar()
    
    return {
        "last_sync": {
            "timestamp": last_sync.created_at.isoformat() if last_sync else None,
            "status": last_sync.status if last_sync else "never_synced",
            "details": last_sync.details if last_sync else {}
        } if last_sync else None,
        "metrics_count": metrics_count,
        "credentials_configured": bool(
            settings.google_ads_client_id and 
            settings.google_ads_refresh_token
        )
    }
