"""
TellSpike Backend - Main Application Entry Point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.mongodb import init_mongodb, close_mongodb, MONGODB_CONFIGURED
from app.api import auth, accounts, dashboard, campaigns, metrics, alerts, reports, notifications, sync
from app.api.alerts_telegram import router as alerts_telegram_router
from app.services.scheduler import start_scheduler, stop_scheduler
from app.services.auto_sync import start_auto_sync_scheduler, stop_auto_sync_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize MongoDB if configured
    if MONGODB_CONFIGURED:
        try:
            success = await init_mongodb()
            if success:
                print("MongoDB connected successfully")
            else:
                print("MongoDB connection failed - running without database")
        except Exception as e:
            print(f"Warning: Could not initialize MongoDB: {e}")
    else:
        print("MongoDB not configured - running without database")
    
    # Start the background scheduler for automatic spike detection
    print("Starting background scheduler for spike alerts...")
    start_scheduler()
    
    # Start auto-sync scheduler (runs every 6 hours)
    print("Starting auto-sync scheduler (every 6 hours)...")
    start_auto_sync_scheduler()
    
    yield
    
    # Shutdown: Stop scheduler and close MongoDB
    stop_scheduler()
    stop_auto_sync_scheduler()
    await close_mongodb()


app = FastAPI(
    title=settings.app_name,
    description="Google Ads Analytics & Alerting Tool API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware - configurable via CORS_ORIGINS env var (comma-separated)
import os

default_origins = [
    settings.frontend_url,
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3003",
]

# Parse additional origins from environment
extra_origins = os.getenv("CORS_ORIGINS", "")
if extra_origins:
    default_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

# Always include standard production URLs as fallback
production_urls = [
    "https://googleadsdashboard-beta.vercel.app",
    "https://googleadsdashboard.vercel.app",
]
allowed_origins = list(set(default_origins + production_urls))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["Accounts"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["Metrics"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["Alerts"])
app.include_router(alerts_telegram_router, tags=["Telegram Alerts"])  # Routes: /api/alerts/*
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(sync.router, prefix="/api", tags=["Sync"])


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "name": settings.app_name,
        "status": "healthy",
        "version": "1.0.0",
        "database": "connected" if MONGODB_CONFIGURED else "not configured"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "database": "connected" if MONGODB_CONFIGURED else "not configured",
        "environment": settings.app_env
    }

