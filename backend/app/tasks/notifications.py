"""
Notification Tasks

Background tasks for sending notifications.
"""

from datetime import date, timedelta, datetime
import asyncio

from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, func

from app.config import settings
from app.database import get_async_database_url
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.models.metrics import DailyMetric
from app.models.alerts import Alert, NotificationChannel
from app.services.notification import NotificationService


def get_async_session():
    """Create a new async session for background tasks."""
    engine = create_async_engine(
        get_async_database_url(settings.database_url),
        echo=False
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_notification(self, alert_id: str):
    """
    Send notification for a specific alert.
    
    Args:
        alert_id: UUID of the alert to send notifications for
    """
    try:
        asyncio.run(_send_notification(alert_id))
    except Exception as e:
        raise self.retry(exc=e)


async def _send_notification(alert_id: str):
    """Async implementation of notification sending."""
    async_session = get_async_session()
    notification_service = NotificationService()
    
    async with async_session() as db:
        # Get alert
        result = await db.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        alert = result.scalar_one_or_none()
        
        if not alert:
            return
        
        # Get account and user
        result = await db.execute(
            select(GoogleAdsAccount).where(GoogleAdsAccount.id == alert.account_id)
        )
        account = result.scalar_one_or_none()
        
        if not account:
            return
        
        # Get user's notification channels
        result = await db.execute(
            select(NotificationChannel)
            .where(NotificationChannel.user_id == account.user_id)
            .where(NotificationChannel.enabled == True)
        )
        channels = result.scalars().all()
        
        # Build notification
        severity_prefix = {
            "INFO": "[INFO]",
            "WARNING": "[WARNING]",
            "CRITICAL": "[ALERT]"
        }
        
        title = f"{severity_prefix.get(alert.severity, '[ALERT]')} {alert.metric.upper()} spike detected"
        message = alert.message
        
        context = {
            "severity": alert.severity,
            "metric": alert.metric,
            "alert_type": alert.alert_type,
            "detected_at": alert.detected_at.isoformat(),
            "account": account.name
        }
        
        if alert.context:
            context.update(alert.context)
        
        # Send to all enabled channels
        for channel in channels:
            try:
                await notification_service.send_alert(
                    channel=channel,
                    title=title,
                    message=message,
                    context=context
                )
            except Exception as e:
                # Log error but continue with other channels
                print(f"Failed to send to channel {channel.id}: {e}")


@shared_task
def send_daily_summary():
    """Send daily summary report to all users."""
    asyncio.run(_send_daily_summary())


async def _send_daily_summary():
    """Async implementation of daily summary."""
    async_session = get_async_session()
    notification_service = NotificationService()
    
    async with async_session() as db:
        # Get all users with active accounts
        result = await db.execute(
            select(User)
            .where(User.is_active == True)
        )
        users = result.scalars().all()
        
        yesterday = date.today() - timedelta(days=1)
        
        for user in users:
            # Get user's accounts
            result = await db.execute(
                select(GoogleAdsAccount)
                .where(GoogleAdsAccount.user_id == user.id)
                .where(GoogleAdsAccount.is_active == True)
            )
            accounts = result.scalars().all()
            
            if not accounts:
                continue
            
            account_ids = [a.id for a in accounts]
            
            # Get yesterday's metrics
            result = await db.execute(
                select(
                    func.sum(DailyMetric.cost_micros).label("cost_micros"),
                    func.sum(DailyMetric.conversions).label("conversions"),
                    func.sum(DailyMetric.conversion_value).label("conversion_value"),
                )
                .where(DailyMetric.account_id.in_(account_ids))
                .where(DailyMetric.date == yesterday)
            )
            row = result.one()
            
            cost = float((row.cost_micros or 0) / 1_000_000)
            conversions = float(row.conversions or 0)
            conversion_value = float(row.conversion_value or 0)
            roas = (conversion_value / cost) if cost > 0 else 0
            
            # Count alerts from yesterday
            result = await db.execute(
                select(func.count(Alert.id))
                .where(Alert.account_id.in_(account_ids))
                .where(func.date(Alert.detected_at) == yesterday)
            )
            alert_count = result.scalar_one()
            
            # Get notification channels
            result = await db.execute(
                select(NotificationChannel)
                .where(NotificationChannel.user_id == user.id)
                .where(NotificationChannel.enabled == True)
            )
            channels = result.scalars().all()
            
            # Send summary to each channel
            summary_data = {
                "total_spend": cost,
                "conversions": conversions,
                "conversion_value": conversion_value,
                "roas": roas,
                "alert_count": alert_count,
                "date": yesterday.isoformat()
            }
            
            for channel in channels:
                try:
                    await notification_service.send_daily_summary(channel, summary_data)
                except Exception as e:
                    print(f"Failed to send daily summary to channel {channel.id}: {e}")
