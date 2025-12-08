"""
Alerts and Notification Models
"""

import uuid
from datetime import datetime
from typing import Optional
from decimal import Decimal

from sqlalchemy import String, Boolean, DateTime, Numeric, JSON, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class AlertSeverity(str, enum.Enum):
    """Alert severity levels."""
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class AlertType(str, enum.Enum):
    """Types of alerts."""
    POSITIVE_SPIKE = "POSITIVE_SPIKE"
    NEGATIVE_SPIKE = "NEGATIVE_SPIKE"
    VOLUME_ANOMALY = "VOLUME_ANOMALY"
    THRESHOLD_BREACH = "THRESHOLD_BREACH"


class NotificationChannelType(str, enum.Enum):
    """Notification channel types."""
    EMAIL = "EMAIL"
    SLACK = "SLACK"
    WEBHOOK = "WEBHOOK"
    IN_APP = "IN_APP"


class Alert(Base):
    """Spike/Anomaly alerts."""
    
    __tablename__ = "alerts"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("google_ads_accounts.id", ondelete="CASCADE"),
        nullable=False
    )
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="SET NULL"),
        nullable=True
    )
    metric: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True
    )
    alert_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        default="INFO"
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    context: Mapped[dict] = mapped_column(
        JSON,
        default=dict
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    is_notified: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    detected_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    account = relationship("GoogleAdsAccount", back_populates="alerts")
    campaign = relationship("Campaign", back_populates="alerts")
    
    def __repr__(self) -> str:
        return f"<Alert {self.severity}: {self.metric} - {self.alert_type}>"


class AlertSetting(Base):
    """User-defined alert settings and thresholds."""
    
    __tablename__ = "alert_settings"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("google_ads_accounts.id", ondelete="CASCADE"),
        nullable=True
    )
    metric: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    threshold_percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        default=30.0  # Default 30% change threshold
    )
    threshold_absolute: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True
    )
    quiet_hours_start: Mapped[Optional[int]] = mapped_column(
        nullable=True  # Hour of day (0-23)
    )
    quiet_hours_end: Mapped[Optional[int]] = mapped_column(
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="alert_settings")
    
    def __repr__(self) -> str:
        return f"<AlertSetting {self.metric}: {self.threshold_percent}%>"


class NotificationChannel(Base):
    """User notification channels (email, Slack, webhook)."""
    
    __tablename__ = "notification_channels"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    channel_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    config: Mapped[dict] = mapped_column(
        JSON,
        default=dict
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="notification_channels")
    
    def __repr__(self) -> str:
        return f"<NotificationChannel {self.channel_type}>"


class SavedReport(Base):
    """User-saved custom reports and graphs."""
    
    __tablename__ = "saved_reports"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    chart_type: Mapped[str] = mapped_column(
        String(50),
        default="line"
    )
    config: Mapped[dict] = mapped_column(
        JSON,
        default=dict
    )
    pinned: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="saved_reports")
    
    def __repr__(self) -> str:
        return f"<SavedReport {self.name}>"


class SyncLog(Base):
    """Data sync logs for tracking sync status."""
    
    __tablename__ = "sync_logs"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("google_ads_accounts.id", ondelete="CASCADE"),
        nullable=False
    )
    sync_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="PENDING"
    )
    details: Mapped[dict] = mapped_column(
        JSON,
        default=dict
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )
    
    # Relationships
    account = relationship("GoogleAdsAccount", back_populates="sync_logs")
    
    def __repr__(self) -> str:
        return f"<SyncLog {self.sync_type}: {self.status}>"
