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
