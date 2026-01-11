"""
Manual Sync API Endpoint

Trigger Google Ads data sync manually.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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
    db: AsyncSession = Depends(get_db)
):
    """
    Fetch Google Ads data LIVE from API for any date range.
    This endpoint fetches directly from Google Ads API without requiring authentication.
    Used for on-demand historical data fetching.
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
        total_metrics = {
            "impressions": 0,
            "clicks": 0,
            "cost": Decimal("0"),
            "conversions": Decimal("0"),
            "conversion_value": Decimal("0")
        }
        
        for account_info in child_accounts:
            customer_id = str(account_info['id'])
            
            try:
                metrics_data = await google_ads_service.fetch_daily_metrics(
                    customer_id=customer_id,
                    refresh_token=refresh_token,
                    start_date=start,
                    end_date=end
                )
                
                for row in metrics_data:
                    campaign_id = row['google_campaign_id']
                    campaign_name = row['campaign_name']
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
                    all_campaigns[campaign_id]["conversion_value"] += conversion_value
                    
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
                    
            except Exception as e:
                print(f"Error fetching account {customer_id}: {e}")
                continue
        
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
        
        return {
            "success": True,
            "source": "live_api",
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
