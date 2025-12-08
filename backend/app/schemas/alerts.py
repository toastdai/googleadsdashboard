"""
Alert Schemas - Spike alerts and notifications
"""

from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    """Base alert schema."""
    metric: str
    alert_type: str
    severity: Literal["INFO", "WARNING", "CRITICAL"]
    message: str


class AlertResponse(AlertBase):
    """Alert response schema."""
    id: UUID
    account_id: UUID
    campaign_id: Optional[UUID] = None
    campaign_name: Optional[str] = None
    context: dict
    is_read: bool
    detected_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """Response containing list of alerts."""
    alerts: List[AlertResponse]
    total: int
    unread_count: int


class AlertSettingBase(BaseModel):
    """Base alert setting schema."""
    metric: str
    threshold_percent: Decimal = Field(default=30.0, ge=0, le=100)
    threshold_absolute: Optional[Decimal] = None
    enabled: bool = True
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23)


class AlertSettingCreate(AlertSettingBase):
    """Schema for creating alert settings."""
    account_id: Optional[UUID] = None


class AlertSettingUpdate(BaseModel):
    """Schema for updating alert settings."""
    threshold_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    threshold_absolute: Optional[Decimal] = None
    enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = Field(None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(None, ge=0, le=23)


class AlertSettingResponse(AlertSettingBase):
    """Alert setting response schema."""
    id: UUID
    user_id: UUID
    account_id: Optional[UUID] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AlertSettingsListResponse(BaseModel):
    """Response containing list of alert settings."""
    settings: List[AlertSettingResponse]


class NotificationChannelBase(BaseModel):
    """Base notification channel schema."""
    channel_type: Literal["EMAIL", "SLACK", "WEBHOOK", "IN_APP"]
    config: dict = {}
    enabled: bool = True


class NotificationChannelCreate(NotificationChannelBase):
    """Schema for creating notification channel."""
    pass


class NotificationChannelResponse(NotificationChannelBase):
    """Notification channel response schema."""
    id: UUID
    created_at: datetime
    
    class Config:
        from_attributes = True


class NotificationChannelListResponse(BaseModel):
    """Response containing list of notification channels."""
    channels: List[NotificationChannelResponse]


class TestNotificationRequest(BaseModel):
    """Request to send test notification."""
    channel_id: UUID
