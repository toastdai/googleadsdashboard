"""
Account Schemas - Google Ads account management
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


class GoogleAdsAccountBase(BaseModel):
    """Base Google Ads account schema."""
    customer_id: str = Field(..., pattern=r"^\d{10}$")
    name: str
    currency_code: str = "INR"
    is_manager: bool = False


class GoogleAdsAccountCreate(GoogleAdsAccountBase):
    """Schema for creating a linked account."""
    refresh_token: str


class GoogleAdsAccountResponse(GoogleAdsAccountBase):
    """Schema for account response."""
    id: UUID
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class AccountListResponse(BaseModel):
    """Response containing list of linked accounts."""
    accounts: List[GoogleAdsAccountResponse]
    total: int


class AccountSyncStatus(BaseModel):
    """Account sync status response."""
    account_id: UUID
    status: str
    last_sync_at: Optional[datetime] = None
    next_sync_at: Optional[datetime] = None
    details: Optional[dict] = None


class AccessibleAccount(BaseModel):
    """Accessible Google Ads account from OAuth."""
    customer_id: str
    name: str
    is_manager: bool
    currency_code: str
