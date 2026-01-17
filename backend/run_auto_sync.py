
import asyncio
import logging
import sys
from sqlalchemy import select
from app.database import async_session_maker
from app.services.sync_service import SyncService
from app.services.google_ads import GoogleAdsService
from app.models.user import User
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    """
    Independent script to trigger the smart 'sync_recent' logic.
    Designed to be run by a Cron Job (e.g., Render Cron).
    """
    logger.info("Starting Auto-Sync Cron Job...")

    async with async_session_maker() as session:
        # 1. Get the primary user (toastdai)
        # We assume there's one main admin user we are syncing for.
        # In multi-tenant, we might iterate all users.
        result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.error("No user found. Cannot run sync.")
            sys.exit(1)

        # 2. Initialize Services
        ga_service = GoogleAdsService()
        sync_service = SyncService(session, ga_service)

        # 3. specific configuration
        manager_id = settings.google_ads_login_customer_id
        refresh_token = settings.google_ads_refresh_token

        if not manager_id or not refresh_token:
             logger.error("Missing Google Ads credentials in environment.")
             sys.exit(1)

        try:
            # 4. Run the smart sync
            # This will automatically detect the gap and fill it up to today
            await sync_service.sync_recent(
                manager_id=manager_id, 
                refresh_token=refresh_token, 
                user_id=user.id
            )
            logger.info("Auto-Sync Cron Job Completed Successfully.")
        except Exception as e:
             logger.error(f"Auto-Sync Job Failed: {e}")
             sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
