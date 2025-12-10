"""
Telegram Alert API Routes
FREE spike notifications via Telegram Bot
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services import get_telegram_service, get_spike_detector
from ..services.scheduler import get_scheduler_status

router = APIRouter(prefix="/api/alerts", tags=["Telegram Alerts"])


class TestMessageRequest(BaseModel):
    """Request body for sending a test message."""
    message: str


class ConfigResponse(BaseModel):
    """Response showing current alert configuration."""
    telegram_configured: bool
    spike_threshold_percent: float
    frontend_url: str
    scheduler_running: bool
    scheduler_interval_minutes: Optional[int]
    next_check: Optional[str]


@router.get("/config")
async def get_alert_config() -> ConfigResponse:
    """Get current alert configuration status."""
    telegram = await get_telegram_service()
    detector = get_spike_detector()
    scheduler_status = get_scheduler_status()
    
    return ConfigResponse(
        telegram_configured=telegram.is_configured,
        spike_threshold_percent=detector.threshold,
        frontend_url=detector.frontend_url,
        scheduler_running=scheduler_status.get("running", False),
        scheduler_interval_minutes=scheduler_status.get("interval_minutes"),
        next_check=scheduler_status.get("next_run")
    )


@router.post("/check-spikes")
async def check_spikes():
    """
    Manually check for spikes in partner metrics.
    This compares current values against the last recorded values.
    """
    detector = get_spike_detector()
    result = await detector.check_and_alert()
    return result


@router.post("/test-message")
async def send_test_message(request: TestMessageRequest):
    """
    Send a test Telegram message to verify configuration.
    """
    telegram = await get_telegram_service()
    
    if not telegram.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Telegram service not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables."
        )
    
    result = await telegram.send_message(request.message)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to send message")
        )
    
    return result


@router.post("/test-connection")
async def test_telegram_connection():
    """
    Send a test connection message to verify Telegram bot setup.
    """
    telegram = await get_telegram_service()
    
    if not telegram.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Telegram service not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
        )
    
    result = await telegram.send_test_message()
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to send test message")
        )
    
    return {
        "success": True,
        "message": "Telegram connected successfully! Check your Telegram for the welcome message.",
        "message_id": result.get("message_id")
    }


@router.post("/test-spike-alert")
async def send_test_spike_alert():
    """
    Send a test spike alert to verify the alert format.
    """
    telegram = await get_telegram_service()
    
    if not telegram.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Telegram service not configured"
        )
    
    result = await telegram.send_spike_alert(
        metric_name="Test Revenue",
        network="Kelkoo",
        current_value=1500.00,
        previous_value=1000.00,
        change_percent=50.0,
        direction="up"
    )
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to send test alert")
        )
    
    return {
        "success": True,
        "message": "Test spike alert sent! Check your Telegram.",
        "message_id": result.get("message_id")
    }
