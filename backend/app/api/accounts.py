"""
Accounts API Routes

Manage linked Google Ads accounts.
"""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.schemas.account import (
    GoogleAdsAccountCreate,
    GoogleAdsAccountResponse,
    AccountListResponse,
    AccountSyncStatus
)
from app.services.auth import get_current_user
from app.services.google_ads import GoogleAdsService
from app.tasks.sync import trigger_account_sync


router = APIRouter()


@router.get("", response_model=AccountListResponse)
async def list_accounts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all linked Google Ads accounts for the current user."""
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.user_id == current_user.id)
        .where(GoogleAdsAccount.is_active == True)
        .order_by(GoogleAdsAccount.name)
    )
    accounts = result.scalars().all()
    
    return AccountListResponse(
        accounts=[GoogleAdsAccountResponse.model_validate(acc) for acc in accounts],
        total=len(accounts)
    )


@router.post("", response_model=GoogleAdsAccountResponse, status_code=status.HTTP_201_CREATED)
async def link_account(
    account_data: GoogleAdsAccountCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Link a new Google Ads account."""
    # Check if account already linked
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.customer_id == account_data.customer_id)
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        if existing.user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account already linked"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Account is linked to another user"
            )
    
    # Validate the refresh token works
    google_ads = GoogleAdsService()
    try:
        await google_ads.validate_account_access(
            account_data.customer_id,
            account_data.refresh_token
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not validate account access: {str(e)}"
        )
    
    # Create account
    account = GoogleAdsAccount(
        user_id=current_user.id,
        customer_id=account_data.customer_id,
        name=account_data.name,
        refresh_token=account_data.refresh_token,
        currency_code=account_data.currency_code,
        is_manager=account_data.is_manager
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    
    # Trigger initial sync
    trigger_account_sync.delay(str(account.id), full_sync=True)
    
    return account


@router.get("/{account_id}", response_model=GoogleAdsAccountResponse)
async def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific linked account."""
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.id == account_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Unlink a Google Ads account."""
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.id == account_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Soft delete - mark as inactive
    account.is_active = False
    await db.commit()


@router.post("/{account_id}/sync")
async def trigger_sync(
    account_id: UUID,
    full_sync: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually trigger data sync for an account."""
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.id == account_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Trigger sync task
    task = trigger_account_sync.delay(str(account.id), full_sync=full_sync)
    
    return {
        "message": "Sync triggered",
        "task_id": task.id,
        "account_id": str(account_id),
        "full_sync": full_sync
    }


@router.get("/{account_id}/status", response_model=AccountSyncStatus)
async def get_sync_status(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get sync status for an account."""
    result = await db.execute(
        select(GoogleAdsAccount)
        .where(GoogleAdsAccount.id == account_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return AccountSyncStatus(
        account_id=account.id,
        status="SYNCED" if account.last_sync_at else "PENDING",
        last_sync_at=account.last_sync_at,
        next_sync_at=None,  # Would be calculated based on schedule
        details=None
    )
