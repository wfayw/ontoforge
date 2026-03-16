from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit import AuditLogResponse, AuditLogListResponse
from app.services.auth_service import require_admin

router = APIRouter()


@router.get("/logs", response_model=AuditLogListResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    username: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = select(AuditLog)
    count_query = select(func.count()).select_from(AuditLog)

    if action:
        query = query.where(AuditLog.action == action)
        count_query = count_query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
        count_query = count_query.where(AuditLog.resource_type == resource_type)
    if username:
        query = query.where(AuditLog.username.contains(username))
        count_query = count_query.where(AuditLog.username.contains(username))

    total = await db.scalar(count_query) or 0
    result = await db.execute(
        query.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = result.scalars().all()

    return AuditLogListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/actions", response_model=list[str])
async def list_audit_actions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(AuditLog.action).distinct().order_by(AuditLog.action)
    )
    return result.scalars().all()


@router.get("/resource-types", response_model=list[str])
async def list_resource_types(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(
        select(AuditLog.resource_type).distinct().order_by(AuditLog.resource_type)
    )
    return result.scalars().all()
