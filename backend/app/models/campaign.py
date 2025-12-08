"""
Campaign, Ad Group, and Keyword Models
"""

import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Campaign(Base):
    """Google Ads Campaign."""
    
    __tablename__ = "campaigns"
    
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
    google_campaign_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="UNKNOWN"
    )
    campaign_type: Mapped[str] = mapped_column(
        String(50),
        default="UNKNOWN"
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
    account = relationship("GoogleAdsAccount", back_populates="campaigns")
    ad_groups = relationship(
        "AdGroup",
        back_populates="campaign",
        cascade="all, delete-orphan"
    )
    daily_metrics = relationship(
        "DailyMetric",
        back_populates="campaign",
        cascade="all, delete-orphan"
    )
    hourly_metrics = relationship(
        "HourlyMetric",
        back_populates="campaign",
        cascade="all, delete-orphan"
    )
    alerts = relationship(
        "Alert",
        back_populates="campaign",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Campaign {self.google_campaign_id}: {self.name}>"


class AdGroup(Base):
    """Google Ads Ad Group."""
    
    __tablename__ = "ad_groups"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False
    )
    google_adgroup_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="UNKNOWN"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    campaign = relationship("Campaign", back_populates="ad_groups")
    keywords = relationship(
        "Keyword",
        back_populates="ad_group",
        cascade="all, delete-orphan"
    )
    daily_metrics = relationship(
        "DailyMetric",
        back_populates="ad_group",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<AdGroup {self.google_adgroup_id}: {self.name}>"


class Keyword(Base):
    """Google Ads Keyword."""
    
    __tablename__ = "keywords"
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    ad_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ad_groups.id", ondelete="CASCADE"),
        nullable=False
    )
    google_keyword_id: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        index=True
    )
    text: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    match_type: Mapped[str] = mapped_column(
        String(50),
        default="EXACT"
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="UNKNOWN"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    ad_group = relationship("AdGroup", back_populates="keywords")
    daily_metrics = relationship(
        "DailyMetric",
        back_populates="keyword",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self) -> str:
        return f"<Keyword {self.google_keyword_id}: {self.text}>"
