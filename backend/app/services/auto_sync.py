"""
Background Sync Scheduler

Runs Google Ads data sync every 6 hours automatically.
"""

import asyncio
from datetime import date, timedelta, datetime
from typing import Optional
import threading
import time

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.config import settings
from app.database import get_async_database_url
from app.services.google_ads import GoogleAdsService
from app.services.sync_service import SyncService
from app.models.user import User


# Global scheduler thread
_scheduler_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def get_async_session():
    """Create a new async session for background tasks."""
    engine = create_async_engine(
        get_async_database_url(settings.database_url),
        echo=False
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def run_auto_sync():
    """Run automatic sync for all users."""
    print(f"[{datetime.now()}] Starting automatic Google Ads sync...")
    
    try:
        async_session = get_async_session()
        
        async with async_session() as db:
            # Get all active users
            result = await db.execute(select(User).where(User.is_active == True))
            users = result.scalars().all()
            
            if not users:
                print("No active users found for sync")
                return
            
            # Calculate date range (last 7 days)
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=7)
            
            # Initialize services
            google_ads_service = GoogleAdsService()
            sync_service = SyncService(db, google_ads_service)
            
            # Get credentials from settings
            manager_id = settings.google_ads_login_customer_id
            refresh_token = settings.google_ads_refresh_token
            
            if not manager_id or not refresh_token:
                print("Google Ads credentials not configured, skipping sync")
                return
            
            # Sync for first user (or all users if needed)
            user = users[0]
            print(f"Syncing data for user: {user.email}")
            
            await sync_service.sync_all_accounts(
                manager_id=manager_id,
                refresh_token=refresh_token,
                start_date=start_date,
                end_date=end_date,
                user_id=user.id
            )
            
            print(f"[{datetime.now()}] ✅ Auto-sync completed successfully!")
            
    except Exception as e:
        print(f"[{datetime.now()}] ❌ Auto-sync failed: {e}")


def scheduler_loop():
    """Main scheduler loop - runs every 6 hours."""
    print("🚀 Background sync scheduler started (runs every 6 hours)")
    
    # Run initial sync after 1 minute
    time.sleep(60)
    asyncio.run(run_auto_sync())
    
    while not _stop_event.is_set():
        # Wait 6 hours
        for _ in range(6 * 60 * 60):  # 6 hours in seconds
            if _stop_event.is_set():
                break
            time.sleep(1)
        
        if not _stop_event.is_set():
            asyncio.run(run_auto_sync())
    
    print("Background sync scheduler stopped")


def start_auto_sync_scheduler():
    """Start the background sync scheduler."""
    global _scheduler_thread
    
    if _scheduler_thread and _scheduler_thread.is_alive():
        print("Scheduler already running")
        return
    
    _stop_event.clear()
    _scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
    _scheduler_thread.start()


def stop_auto_sync_scheduler():
    """Stop the background sync scheduler."""
    global _scheduler_thread
    
    if _scheduler_thread and _scheduler_thread.is_alive():
        print("Stopping background sync scheduler...")
        _stop_event.set()
        _scheduler_thread.join(timeout=5)
        _scheduler_thread = None
