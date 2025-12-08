"""
Metrics Models - Daily and Hourly performance metrics
"""

import uuid
from datetime import datetime, date
from typing import Optional
from decimal import Decimal

from sqlalchemy import String, DateTime, Date, Integer, BigInteger, Numeric, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailyMetric(Base):
    """Daily performance metrics at various granularities."""
    
    __tablename__ = "daily_metrics"
    
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
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True
    )
    ad_group_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ad_groups.id", ondelete="CASCADE"),
        nullable=True
    )
    keyword_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("keywords.id", ondelete="CASCADE"),
        nullable=True
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True
    )
    device: Mapped[str] = mapped_column(
        String(50),
        default="UNSPECIFIED"
    )
    network: Mapped[str] = mapped_column(
        String(50),
        default="UNSPECIFIED"
    )
    
    # Core metrics
    impressions: Mapped[int] = mapped_column(
        BigInteger,
        default=0
    )
    clicks: Mapped[int] = mapped_column(
        BigInteger,
        default=0
    )
    cost_micros: Mapped[Decimal] = mapped_column(
        Numeric(20, 0),
        default=0
    )
    conversions: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    conversion_value: Mapped[Decimal] = mapped_column(
        Numeric(20, 2),
        default=0
    )
    
    # Computed metrics (stored for performance)
    ctr: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    cpc: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )
    cpa: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(15, 2),
        nullable=True
    )
    roas: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 4),
        nullable=True
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    account = relationship("GoogleAdsAccount", back_populates="daily_metrics")
    campaign = relationship("Campaign", back_populates="daily_metrics")
    ad_group = relationship("AdGroup", back_populates="daily_metrics")
    keyword = relationship("Keyword", back_populates="daily_metrics")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_daily_metrics_account_date", "account_id", "date"),
        Index("ix_daily_metrics_campaign_date", "campaign_id", "date"),
    )
    
    @property
    def cost(self) -> Decimal:
        """Convert cost from micros to currency units."""
        return Decimal(self.cost_micros) / Decimal(1_000_000)
    
    def calculate_derived_metrics(self):
        """Calculate CTR, CPC, CPA, ROAS from raw metrics."""
        if self.impressions > 0:
            self.ctr = Decimal(self.clicks) / Decimal(self.impressions)
        if self.clicks > 0:
            self.cpc = self.cost / Decimal(self.clicks)
        if self.conversions > 0:
            self.cpa = self.cost / self.conversions
            if self.cost > 0:
                self.roas = self.conversion_value / self.cost
    
    def __repr__(self) -> str:
        return f"<DailyMetric {self.date} - {self.impressions} impr, {self.clicks} clicks>"


class HourlyMetric(Base):
    """Hourly performance metrics for spike detection."""
    
    __tablename__ = "hourly_metrics"
    
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
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=True
    )
    date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )
    hour: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    
    # Core metrics
    impressions: Mapped[int] = mapped_column(
        BigInteger,
        default=0
    )
    clicks: Mapped[int] = mapped_column(
        BigInteger,
        default=0
    )
    cost_micros: Mapped[Decimal] = mapped_column(
        Numeric(20, 0),
        default=0
    )
    conversions: Mapped[Decimal] = mapped_column(
        Numeric(15, 2),
        default=0
    )
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )
    
    # Relationships
    account = relationship("GoogleAdsAccount", back_populates="hourly_metrics")
    campaign = relationship("Campaign", back_populates="hourly_metrics")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index("ix_hourly_metrics_account_date_hour", "account_id", "date", "hour"),
        Index("ix_hourly_metrics_campaign_date_hour", "campaign_id", "date", "hour"),
    )
    
    @property
    def cost(self) -> Decimal:
        """Convert cost from micros to currency units."""
        return Decimal(self.cost_micros) / Decimal(1_000_000)
    
    def __repr__(self) -> str:
        return f"<HourlyMetric {self.date} {self.hour}:00 - {self.impressions} impr>"
