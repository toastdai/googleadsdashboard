"""
Manual Sync API Endpoint

Trigger Google Ads data sync manually.
"""

from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.google_ads import GoogleAdsService
from app.services.sync_service import SyncService
from app.services.auth import get_current_user
from app.models.user import User
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
        
        # Get credentials from settings
        manager_id = settings.google_ads_login_customer_id
        refresh_token = settings.google_ads_refresh_token
        
        if not manager_id or not refresh_token:
            error_details = []
            if not manager_id:
                error_details.append("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not set")
            if not refresh_token:
                error_details.append("GOOGLE_ADS_REFRESH_TOKEN is not set")
            
            raise HTTPException(
                status_code=400,
                detail=f"Google Ads credentials not configured on backend: {', '.join(error_details)}"
            )
        
        # Ensure manager_id is properly formatted (10 digits, no hyphens)
        manager_id = str(manager_id).replace("-", "")
        
        # Debug logging
        print(f"DEBUG: manager_id = {manager_id}, type = {type(manager_id)}, len = {len(manager_id)}")
        print(f"DEBUG: refresh_token exists = {bool(refresh_token)}, first 20 chars = {refresh_token[:20] if refresh_token else 'None'}")
        
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
