"""
Alerts API Routes

Spike alerts and notification settings management.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.database import get_db
from app.models.user import User
from app.models.account import GoogleAdsAccount
from app.models.alerts import Alert, AlertSetting, NotificationChannel
from app.schemas.alerts import (
    AlertResponse,
    AlertListResponse,
    AlertSettingCreate,
    AlertSettingUpdate,
    AlertSettingResponse,
    AlertSettingsListResponse,
    NotificationChannelCreate,
    NotificationChannelResponse,
    NotificationChannelListResponse,
    TestNotificationRequest
)
from app.services.auth import get_current_user
from app.services.notification import NotificationService


router = APIRouter()


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    account_ids: Optional[List[UUID]] = Query(None),
    severity: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List spike alerts for the user's accounts."""
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return AlertListResponse(alerts=[], total=0, unread_count=0)
    
    # Build query
    query = (
        select(Alert)
        .where(Alert.account_id.in_(account_ids))
        .order_by(Alert.detected_at.desc())
    )
    
    if severity:
        query = query.where(Alert.severity == severity)
    if is_read is not None:
        query = query.where(Alert.is_read == is_read)
    
    # Get total count
    count_result = await db.execute(
        select(func.count(Alert.id))
        .where(Alert.account_id.in_(account_ids))
    )
    total = count_result.scalar_one()
    
    # Get unread count
    unread_result = await db.execute(
        select(func.count(Alert.id))
        .where(Alert.account_id.in_(account_ids))
        .where(Alert.is_read == False)
    )
    unread_count = unread_result.scalar_one()
    
    # Execute paginated query
    result = await db.execute(
        query.limit(limit).offset(offset)
    )
    alerts = result.scalars().all()
    
    return AlertListResponse(
        alerts=[AlertResponse.model_validate(a) for a in alerts],
        total=total,
        unread_count=unread_count
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific alert."""
    result = await db.execute(
        select(Alert)
        .join(GoogleAdsAccount)
        .where(Alert.id == alert_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return alert


@router.patch("/{alert_id}/read")
async def mark_alert_read(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark an alert as read."""
    result = await db.execute(
        select(Alert)
        .join(GoogleAdsAccount)
        .where(Alert.id == alert_id)
        .where(GoogleAdsAccount.user_id == current_user.id)
    )
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_read = True
    await db.commit()
    
    return {"message": "Alert marked as read"}


@router.post("/read-all")
async def mark_all_alerts_read(
    account_ids: Optional[List[UUID]] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all alerts as read."""
    # Get user's account IDs if not specified
    if not account_ids:
        result = await db.execute(
            select(GoogleAdsAccount.id)
            .where(GoogleAdsAccount.user_id == current_user.id)
            .where(GoogleAdsAccount.is_active == True)
        )
        account_ids = [row[0] for row in result.all()]
    
    if not account_ids:
        return {"message": "No alerts to mark", "count": 0}
    
    result = await db.execute(
        update(Alert)
        .where(Alert.account_id.in_(account_ids))
        .where(Alert.is_read == False)
        .values(is_read=True)
    )
    
    await db.commit()
    
    return {"message": "All alerts marked as read", "count": result.rowcount}


# Alert Settings Endpoints

@router.get("/settings", response_model=AlertSettingsListResponse)
async def get_alert_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all alert settings for the user."""
    result = await db.execute(
        select(AlertSetting)
        .where(AlertSetting.user_id == current_user.id)
        .order_by(AlertSetting.metric)
    )
    settings = result.scalars().all()
    
    return AlertSettingsListResponse(
        settings=[AlertSettingResponse.model_validate(s) for s in settings]
    )


@router.post("/settings", response_model=AlertSettingResponse, status_code=status.HTTP_201_CREATED)
async def create_alert_setting(
    setting: AlertSettingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new alert setting."""
    new_setting = AlertSetting(
        user_id=current_user.id,
        account_id=setting.account_id,
        metric=setting.metric,
        threshold_percent=setting.threshold_percent,
        threshold_absolute=setting.threshold_absolute,
        enabled=setting.enabled,
        quiet_hours_start=setting.quiet_hours_start,
        quiet_hours_end=setting.quiet_hours_end
    )
    db.add(new_setting)
    await db.commit()
    await db.refresh(new_setting)
    
    return new_setting


@router.put("/settings/{setting_id}", response_model=AlertSettingResponse)
async def update_alert_setting(
    setting_id: UUID,
    update_data: AlertSettingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an alert setting."""
    result = await db.execute(
        select(AlertSetting)
        .where(AlertSetting.id == setting_id)
        .where(AlertSetting.user_id == current_user.id)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(setting, key, value)
    
    await db.commit()
    await db.refresh(setting)
    
    return setting


@router.delete("/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_setting(
    setting_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an alert setting."""
    result = await db.execute(
        select(AlertSetting)
        .where(AlertSetting.id == setting_id)
        .where(AlertSetting.user_id == current_user.id)
    )
    setting = result.scalar_one_or_none()
    
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    
    await db.delete(setting)
    await db.commit()
