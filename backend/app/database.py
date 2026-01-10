"""
TellSpike Backend - Database Configuration

Async SQLAlchemy setup with PostgreSQL.
Handles missing database gracefully for environments without PostgreSQL.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


# Convert sync URL to async URL
def get_async_database_url(url: str) -> str:
    """Convert postgresql:// to postgresql+asyncpg://"""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


# Check if database is configured
DATABASE_CONFIGURED = (
    settings.database_url 
    # and settings.database_url != "postgresql://postgres:password@localhost:5432/tellspike"
    # and not settings.database_url.startswith("postgresql://localhost")
)

# Create async engine only if database is configured
engine = None
async_session_maker = None

if DATABASE_CONFIGURED:
    try:
        engine = create_async_engine(
            get_async_database_url(settings.database_url),
            echo=settings.debug,
            poolclass=NullPool,
        )
        async_session_maker = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    except Exception as e:
        print(f"Warning: Could not configure database: {e}")
        engine = None
        async_session_maker = None


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    if async_session_maker is None:
        raise RuntimeError("Database not configured")
    
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

