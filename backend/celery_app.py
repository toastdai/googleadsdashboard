"""
TellSpike Celery Application

Configures Celery for background task processing.
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings


# Create Celery app
celery_app = Celery(
    "tellspike",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.tasks.sync",
        "app.tasks.alerts",
        "app.tasks.notifications",
    ]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    task_soft_time_limit=3000,  # Soft limit 50 minutes
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Scheduled tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Sync all accounts every hour
    "sync-all-accounts": {
        "task": "app.tasks.sync.sync_all_accounts",
        "schedule": crontab(minute=0),  # Every hour at :00
    },
    # Run spike detection every 2 hours
    "run-spike-detection": {
        "task": "app.tasks.alerts.run_spike_detection",
        "schedule": crontab(minute=30, hour="*/2"),  # Every 2 hours at :30
    },
    # Process and send alert notifications every 15 minutes
    "process-alerts": {
        "task": "app.tasks.alerts.process_alerts",
        "schedule": crontab(minute="*/15"),  # Every 15 minutes
    },
    # Send daily summary at 8 AM
    "daily-summary": {
        "task": "app.tasks.notifications.send_daily_summary",
        "schedule": crontab(minute=0, hour=8),  # 8:00 AM every day
    },
}


if __name__ == "__main__":
    celery_app.start()
