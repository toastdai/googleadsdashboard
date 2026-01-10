"""
Manual sync trigger script - Run this to sync Google Ads data
"""

import asyncio
from datetime import date, timedelta
from sqlalchemy import select

from app.database import async_session_maker
from app.services.google_ads import GoogleAdsService
from app.services.sync_service import SyncService
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.config import settings


async def run_manual_sync():
    """Trigger manual sync for all users."""
    print("=" * 60)
    print("MANUAL GOOGLE ADS SYNC")
    print("=" * 60)
    
    async with async_session_maker() as db:
        # Get all active users
        result = await db.execute(
            select(User).where(User.is_active == True)
        )
        users = result.scalars().all()
        
        print(f"\n✓ Found {len(users)} active users")
        
        if not users:
            print("❌ No active users found!")
            return
        
        # Sync for each user
        for user in users:
            print(f"\n{'='*60}")
            print(f"Syncing for user: {user.email}")
            print(f"{'='*60}")
            
            # Get user's manager account
            account_result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.user_id == user.id)
                .where(GoogleAdsAccount.is_active == True)
            )
            accounts = account_result.scalars().all()
            
            print(f"✓ User has {len(accounts)} accounts:")
            for acc in accounts:
                print(f"  - {acc.customer_id} ({acc.name}) - Manager: {acc.is_manager}")
            
            if not accounts:
                print(f"❌ No accounts found for {user.email}")
                continue
            
            # Use first active account
            account = accounts[0]
            
            # Calculate date range (last 30 days)
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=30)
            
            print(f"\n📅 Date range: {start_date} to {end_date}")
            print(f"🔑 Using account: {account.customer_id} ({account.name})")
            print(f"🔄 Starting sync...\n")
            
            try:
                # Initialize services
                google_ads_service = GoogleAdsService()
                sync_service = SyncService(db, google_ads_service)
                
                # Determine manager ID
                if account.is_manager:
                    manager_id = account.customer_id
                else:
                    manager_id = settings.google_ads_login_customer_id
                    if not manager_id:
                        print("❌ No manager ID configured!")
                        continue
                
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
                
                print(f"\n✅ SUCCESS! Synced {30} days of data for {user.email}")
                print(f"📊 Data is now available in dashboard!")
                
            except Exception as e:
                print(f"\n❌ SYNC FAILED: {e}")
                import traceback
                traceback.print_exc()
                await db.rollback()
    
    print(f"\n{'='*60}")
    print("SYNC COMPLETE!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(run_manual_sync())
