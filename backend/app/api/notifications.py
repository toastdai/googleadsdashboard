"""
Notifications API Routes

Notification channels management.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.alerts import NotificationChannel
from app.schemas.alerts import (
    NotificationChannelCreate,
    NotificationChannelResponse,
    NotificationChannelListResponse,
    TestNotificationRequest
)
from app.services.auth import get_current_user
from app.services.notification import NotificationService


router = APIRouter()


@router.get("/channels", response_model=NotificationChannelListResponse)
async def list_notification_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all notification channels for the user."""
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.user_id == current_user.id)
        .order_by(NotificationChannel.created_at.desc())
    )
    channels = result.scalars().all()
    
    return NotificationChannelListResponse(
        channels=[NotificationChannelResponse.model_validate(c) for c in channels]
    )


@router.post("/channels", response_model=NotificationChannelResponse, status_code=status.HTTP_201_CREATED)
async def create_notification_channel(
    channel_data: NotificationChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new notification channel."""
    channel = NotificationChannel(
        user_id=current_user.id,
        channel_type=channel_data.channel_type,
        config=channel_data.config,
        enabled=channel_data.enabled
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    
    return channel


@router.get("/channels/{channel_id}", response_model=NotificationChannelResponse)
async def get_notification_channel(
    channel_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific notification channel."""
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.id == channel_id)
        .where(NotificationChannel.user_id == current_user.id)
    )
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    return channel


@router.delete("/channels/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification_channel(
    channel_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification channel."""
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.id == channel_id)
        .where(NotificationChannel.user_id == current_user.id)
    )
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    await db.delete(channel)
    await db.commit()


@router.patch("/channels/{channel_id}/toggle")
async def toggle_notification_channel(
    channel_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle enabled status of a notification channel."""
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.id == channel_id)
        .where(NotificationChannel.user_id == current_user.id)
    )
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    channel.enabled = not channel.enabled
    await db.commit()
    
    return {"channel_id": channel_id, "enabled": channel.enabled}


@router.post("/test")
async def send_test_notification(
    request: TestNotificationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a test notification to a channel."""
    result = await db.execute(
        select(NotificationChannel)
        .where(NotificationChannel.id == request.channel_id)
        .where(NotificationChannel.user_id == current_user.id)
    )
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    try:
        notification_service = NotificationService()
        await notification_service.send_test(channel)
        return {"message": "Test notification sent successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )
