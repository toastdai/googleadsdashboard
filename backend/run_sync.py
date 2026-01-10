import asyncio
import argparse
from datetime import datetime, date
from sqlalchemy import select

from app.database import get_db
from app.services.sync_service import SyncService
from app.services.google_ads import GoogleAdsService
from app.models.user import User
from app.services.auth import get_password_hash

async def main():
    parser = argparse.ArgumentParser(description='Sync Google Ads data')
    parser.add_argument('--start-date', type=str, required=True, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, required=True, help='End date (YYYY-MM-DD)')
    args = parser.parse_args()

    # Get user
    async for session in get_db():
        result = await session.execute(select(User).where(User.email == "toastdcontent@gmail.com"))
        user = result.scalar_one_or_none()
        
        # Run sync
        print(f"Starting sync from {args.start_date} to {args.end_date}...")
        google_ads_service = GoogleAdsService()
        service = SyncService(session, google_ads_service)
        # Assuming user is available from above logic
        if not user:
             raise Exception("User not found")
        
        # Get credentials from settings
        from app.config import settings
        
        manager_id = settings.google_ads_login_customer_id
        refresh_token = settings.google_ads_refresh_token
             
        await service.sync_all_accounts(
            manager_id, 
            refresh_token, 
            date.fromisoformat(args.start_date), 
            date.fromisoformat(args.end_date), 
            user.id
        )
        print("Sync completed.")
        return

if __name__ == "__main__":
    asyncio.run(main())
