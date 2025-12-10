"""
WhatsApp Alert API Routes
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services import get_whatsapp_service, get_spike_detector

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class TestMessageRequest(BaseModel):
    """Request body for sending a test message."""
    message: str


class ConfigResponse(BaseModel):
    """Response showing current alert configuration."""
    whatsapp_configured: bool
    spike_threshold_percent: float
    frontend_url: str


@router.get("/config")
async def get_alert_config() -> ConfigResponse:
    """Get current alert configuration status."""
    whatsapp = get_whatsapp_service()
    detector = get_spike_detector()
    
    return ConfigResponse(
        whatsapp_configured=whatsapp.is_configured,
        spike_threshold_percent=detector.threshold,
        frontend_url=detector.frontend_url
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
    Send a test WhatsApp message to verify configuration.
    """
    whatsapp = get_whatsapp_service()
    
    if not whatsapp.is_configured:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp service not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and ALERT_WHATSAPP_NUMBER environment variables."
        )
    
    result = whatsapp.send_message(request.message)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500,
            detail=result.get("error", "Failed to send message")
        )
    
    return result


@router.post("/test-spike-alert")
async def send_test_spike_alert():
    """
    Send a test spike alert to verify the alert format.
    """
    whatsapp = get_whatsapp_service()
    
    if not whatsapp.is_configured:
        raise HTTPException(
            status_code=503,
            detail="WhatsApp service not configured"
        )
    
    result = whatsapp.send_spike_alert(
        metric_name="Test Metric",
        network="Test Network",
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
    
    return result
