"""
Initialize Database Tables

Run this script to create all database tables.
Usage: python init_db.py
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from app.database import Base, get_async_database_url

# Import all models to register them with Base
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.models.campaign import Campaign, AdGroup
from app.models.metrics import DailyMetric, HourlyMetric
from app.models.partner_metrics import PartnerMetric
from app.models.alerts import Alert, SyncLog


async def init_db():
    """Create all database tables."""
    print("Initializing database...")
    print(f"Database URL: {settings.database_url}")
    
    # Create async engine
    engine = create_async_engine(
        get_async_database_url(settings.database_url),
        echo=True
    )
    
    # Create all tables
    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    print("✅ Database initialized successfully!")


if __name__ == "__main__":
    asyncio.run(init_db())
