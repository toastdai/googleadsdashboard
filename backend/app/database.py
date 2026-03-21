"""
TellSpike Backend - Database Configuration

Async SQLAlchemy setup with PostgreSQL.
Handles missing database gracefully for environments without PostgreSQL.
"""

import os
import ssl as ssl_module
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


def get_async_database_url(url: str) -> tuple:
    """Convert postgresql:// to postgresql+asyncpg:// and handle SSL params.
    
    Returns (url, connect_args) tuple since asyncpg doesn't support 
    sslmode/channel_binding query params directly.
    """
    needs_ssl = False
    
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    # Parse and strip params that asyncpg doesn't understand
    parsed = urlparse(url)
    query_params = parse_qs(parsed.query)
    
    # Check for SSL requirement before stripping
    if 'sslmode' in query_params:
        sslmode = query_params.pop('sslmode')[0]
        if sslmode in ('require', 'verify-ca', 'verify-full', 'prefer'):
            needs_ssl = True
    
    # Remove channel_binding (asyncpg doesn't support it)
    query_params.pop('channel_binding', None)
    
    # Rebuild URL without stripped params
    new_query = urlencode({k: v[0] for k, v in query_params.items()})
    cleaned_url = urlunparse(parsed._replace(query=new_query))
    
    # Build connect_args for SSL
    connect_args = {}
    if needs_ssl:
        ssl_ctx = ssl_module.create_default_context()
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl_module.CERT_NONE
        connect_args["ssl"] = ssl_ctx
    
    return cleaned_url, connect_args


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
        db_url, db_connect_args = get_async_database_url(settings.database_url)
        engine = create_async_engine(
            db_url,
            echo=settings.debug,
            poolclass=NullPool,
            connect_args=db_connect_args,
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

