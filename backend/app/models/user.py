"""
User Model - Application users and authentication
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """User account for the application."""
    
    __tablename__ = "users"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True
    )
    password_hash: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True  # OAuth users may not have password
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False
    )
    settings: Mapped[dict] = mapped_column(
        JSON,
        default=dict,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    
    # Relationships
    google_ads_accounts = relationship(
        "GoogleAdsAccount",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    alert_settings = relationship(
        "AlertSetting",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    notification_channels = relationship(
        "NotificationChannel",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    saved_reports = relationship(
        "SavedReport",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<User {self.email}>"
