from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.alert import AlertRule, Alert
from app.services.auth_service import get_current_user

router = APIRouter()


class AlertRuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    object_type_id: str
    condition: dict
    severity: str = "warning"
    is_active: bool = True


class AlertRuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    object_type_id: str
    condition: dict
    severity: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertResponse(BaseModel):
    id: str
    rule_id: str
    object_id: str
    severity: str
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


@router.get("/rules", response_model=list[AlertRuleResponse])
async def list_rules(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))
    return result.scalars().all()


@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_rule(data: AlertRuleCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    rule = AlertRule(**data.model_dump())
    db.add(rule)
    await db.flush()
    await db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)


@router.get("/", response_model=list[AlertResponse])
async def list_alerts(
    severity: Optional[str] = None,
    is_read: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    stmt = select(Alert).order_by(Alert.created_at.desc())
    if severity:
        stmt = stmt.where(Alert.severity == severity)
    if is_read is not None:
        stmt = stmt.where(Alert.is_read == is_read)
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/count")
async def unread_count(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.is_read == False)
    )
    return {"unread": result.scalar() or 0}


@router.patch("/{alert_id}/read")
async def mark_read(alert_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_read = True
    await db.flush()
    return {"id": alert_id, "is_read": True}


@router.post("/mark-all-read")
async def mark_all_read(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    await db.execute(update(Alert).where(Alert.is_read == False).values(is_read=True))
    return {"success": True}
