"""
Google Ads Account Model - Linked Google Ads accounts
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GoogleAdsAccount(Base):
    """Linked Google Ads account."""
    
    __tablename__ = "google_ads_accounts"
    
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
    customer_id: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    refresh_token: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    currency_code: Mapped[str] = mapped_column(
        String(10),
        default="INR"
    )
    is_manager: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True
    )
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime,
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    user = relationship("User", back_populates="google_ads_accounts")
    campaigns = relationship(
        "Campaign",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    daily_metrics = relationship(
        "DailyMetric",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    hourly_metrics = relationship(
        "HourlyMetric",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    alerts = relationship(
        "Alert",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    sync_logs = relationship(
        "SyncLog",
        back_populates="account",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<GoogleAdsAccount {self.customer_id}: {self.name}>"
