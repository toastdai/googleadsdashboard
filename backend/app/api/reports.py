"""
Reports API Routes

Custom reports and graph management.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.alerts import SavedReport
from app.schemas.reports import (
    SavedReportCreate,
    SavedReportUpdate,
    SavedReportResponse,
    SavedReportListResponse,
    ReportDataResponse,
    ExportRequest
)
from app.services.auth import get_current_user


router = APIRouter()


@router.get("", response_model=SavedReportListResponse)
async def list_reports(
    pinned_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all saved reports for the user."""
    query = (
        select(SavedReport)
        .where(SavedReport.user_id == current_user.id)
        .order_by(SavedReport.pinned.desc(), SavedReport.created_at.desc())
    )
    
    if pinned_only:
        query = query.where(SavedReport.pinned == True)
    
    result = await db.execute(query)
    reports = result.scalars().all()
    
    return SavedReportListResponse(
        reports=[SavedReportResponse.model_validate(r) for r in reports],
        total=len(reports)
    )


@router.post("", response_model=SavedReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_data: SavedReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new saved report."""
    report = SavedReport(
        user_id=current_user.id,
        name=report_data.name,
        chart_type=report_data.chart_type,
        config=report_data.config.model_dump(),
        pinned=report_data.pinned
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    return report


@router.get("/{report_id}", response_model=SavedReportResponse)
async def get_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific saved report."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report


@router.put("/{report_id}", response_model=SavedReportResponse)
async def update_report(
    report_id: UUID,
    update_data: SavedReportUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a saved report."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    update_dict = update_data.model_dump(exclude_unset=True)
    if "config" in update_dict and update_dict["config"]:
        update_dict["config"] = update_dict["config"].model_dump()
    
    for key, value in update_dict.items():
        setattr(report, key, value)
    
    await db.commit()
    await db.refresh(report)
    
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a saved report."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await db.delete(report)
    await db.commit()


@router.patch("/{report_id}/pin")
async def toggle_pin_report(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggle pin status of a report."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report.pinned = not report.pinned
    await db.commit()
    
    return {"report_id": report_id, "pinned": report.pinned}


@router.get("/{report_id}/data", response_model=ReportDataResponse)
async def get_report_data(
    report_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get data for a saved report based on its configuration."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # TODO: Generate report data based on config
    # This would query metrics based on the saved configuration
    # For now, return empty data structure
    
    from app.schemas.reports import ReportConfig
    
    return ReportDataResponse(
        report_id=report.id,
        name=report.name,
        config=ReportConfig.model_validate(report.config),
        data=[],
        generated_at=datetime.utcnow()
    )


@router.post("/{report_id}/export")
async def export_report(
    report_id: UUID,
    export_request: ExportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Export a report in specified format."""
    result = await db.execute(
        select(SavedReport)
        .where(SavedReport.id == report_id)
        .where(SavedReport.user_id == current_user.id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # TODO: Implement actual export functionality
    # This would generate PNG/CSV/PDF based on report data
    
    return {
        "message": f"Export to {export_request.format} initiated",
        "report_id": str(report_id),
        "format": export_request.format
    }
