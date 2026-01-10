"""
Admin sync endpoint - For testing only, remove in production
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta

from app.database import get_db
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.services.google_ads import GoogleAdsService
from app.services.sync_service import SyncService
from app.config import settings

router = APIRouter()


@router.post("/admin/sync-all")
async def admin_sync_all(
    days: int = Query(default=30, description="Number of days to sync"),
    db: AsyncSession = Depends(get_db)
):
    """
    ADMIN ENDPOINT: Sync all users' Google Ads data.
    Remove this in production!
    """
    results = []
    
    # Get all active users
    result = await db.execute(
        select(User).where(User.is_active == True)
    )
    users = result.scalars().all()
    
    for user in users:
        try:
            # Get user's account
            account_result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.user_id == user.id)
                .where(GoogleAdsAccount.is_active == True)
                .limit(1)
            )
            account = account_result.scalar_one_or_none()
            
            if not account:
                results.append({
                    "user": user.email,
                    "status": "skipped",
                    "reason": "No account found"
                })
                continue
            
            # Calculate date range
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=days)
            
            # Initialize services
            google_ads_service = GoogleAdsService()
            sync_service = SyncService(db, google_ads_service)
            
            # Determine manager ID
            if account.is_manager:
                manager_id = account.customer_id
            else:
                manager_id = settings.google_ads_login_customer_id
            
            manager_id = str(manager_id).replace("-", "").strip()
            
            # Run sync
            await sync_service.sync_all_accounts(
                manager_customer_id=manager_id,
                refresh_token=account.refresh_token,
                start_date=start_date,
                end_date=end_date,
                user_id=user.id
            )
            
            await db.commit()
            
            results.append({
                "user": user.email,
                "status": "success",
                "days_synced": days,
                "date_range": f"{start_date} to {end_date}"
            })
            
        except Exception as e:
            await db.rollback()
            results.append({
                "user": user.email,
                "status": "failed",
                "error": str(e)
            })
    
    return {
        "message": "Sync completed",
        "results": results
    }
