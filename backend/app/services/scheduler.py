"""
Background Scheduler for Automatic Spike Detection
Runs every hour to check for metric changes and send Telegram alerts
"""
import os
import asyncio
import logging
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: AsyncIOScheduler = None


async def check_spikes_job():
    """Background job to check for spikes and send alerts."""
    from .spike_detector import get_spike_detector
    from .telegram import get_telegram_service
    
    logger.info(f"[{datetime.now().isoformat()}] Running scheduled spike check...")
    
    try:
        # Check if Telegram is configured
        telegram = await get_telegram_service()
        if not telegram.is_configured:
            logger.warning("Telegram not configured - skipping spike check")
            return
        
        # Run spike detection
        detector = get_spike_detector()
        result = await detector.check_and_alert()
        
        spikes_count = result.get("spikes_detected", 0)
        alerts_sent = result.get("alerts_sent", 0)
        
        if spikes_count > 0:
            logger.info(f"Spike check complete: {spikes_count} spikes detected, {alerts_sent} alerts sent")
        else:
            logger.info("Spike check complete: No spikes detected")
            
    except Exception as e:
        logger.error(f"Error in spike check job: {e}")


async def poll_bot_commands():
    """Background job to poll and respond to Telegram bot commands."""
    from .bot_commands import get_bot_commands
    
    try:
        bot = get_bot_commands()
        await bot.poll_updates()
    except Exception as e:
        logger.error(f"Error polling bot commands: {e}")


def start_scheduler():
    """Start the background scheduler."""
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already running")
        return
    
    # Get check interval from environment (default: 60 minutes)
    check_interval_minutes = int(os.getenv("SPIKE_CHECK_INTERVAL_MINUTES", "60"))
    
    scheduler = AsyncIOScheduler()
    
    # Add the spike check job
    scheduler.add_job(
        check_spikes_job,
        trigger=IntervalTrigger(minutes=check_interval_minutes),
        id="spike_check",
        name="Check for metric spikes",
        replace_existing=True,
        max_instances=1
    )
    
    # Add bot command polling job (every 5 seconds)
    scheduler.add_job(
        poll_bot_commands,
        trigger=IntervalTrigger(seconds=5),
        id="bot_commands",
        name="Poll Telegram bot commands",
        replace_existing=True,
        max_instances=1
    )
    
    scheduler.start()
    logger.info(f"Scheduler started - checking for spikes every {check_interval_minutes} minutes, polling commands every 5 seconds")
    
    # Run initial check after 30 seconds (to let the app fully start)
    async def delayed_initial_check():
        await asyncio.sleep(30)
        await check_spikes_job()
    
    # Schedule the delayed initial check
    asyncio.create_task(delayed_initial_check())


def stop_scheduler():
    """Stop the background scheduler."""
    global scheduler
    
    if scheduler is not None:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    """Get the current scheduler status."""
    global scheduler
    
    if scheduler is None:
        return {"running": False, "next_run": None}
    
    job = scheduler.get_job("spike_check")
    if job:
        next_run = job.next_run_time
        return {
            "running": scheduler.running,
            "interval_minutes": int(os.getenv("SPIKE_CHECK_INTERVAL_MINUTES", "60")),
            "next_run": next_run.isoformat() if next_run else None
        }
    
    return {"running": scheduler.running, "next_run": None}
