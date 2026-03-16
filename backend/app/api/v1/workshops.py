from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.workshop import WorkshopApp, WorkshopWidget
from app.services.auth_service import get_current_user, require_editor
from app.services.audit_service import create_audit_log
from app.services.workshop_service import resolve_widget_data

router = APIRouter()


# ── Schemas ───────────────────────────────────────────

class AppCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "AppstoreOutlined"


class AppUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    layout: Optional[dict] = None
    variables: Optional[dict] = None


class AppResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    icon: Optional[str]
    layout: Optional[dict]
    variables: Optional[dict]
    is_published: bool
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    widget_count: int = 0
    model_config = {"from_attributes": True}


class WidgetCreate(BaseModel):
    widget_type: str
    title: str
    config: Optional[dict] = None
    position: Optional[dict] = None
    data_binding: Optional[dict] = None
    order: int = 0


class WidgetUpdate(BaseModel):
    title: Optional[str] = None
    config: Optional[dict] = None
    position: Optional[dict] = None
    data_binding: Optional[dict] = None
    order: Optional[int] = None


class WidgetResponse(BaseModel):
    id: str
    app_id: str
    widget_type: str
    title: str
    config: Optional[dict]
    position: Optional[dict]
    data_binding: Optional[dict]
    order: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ResolveRequest(BaseModel):
    widgets: list[dict]
    variables: Optional[dict] = None


# ── App CRUD ──────────────────────────────────────────

@router.get("/apps", response_model=list[AppResponse])
async def list_apps(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(WorkshopApp).order_by(WorkshopApp.updated_at.desc()))
    apps = result.scalars().all()

    response = []
    for app in apps:
        wc = await db.execute(
            select(WorkshopWidget).where(WorkshopWidget.app_id == app.id)
        )
        count = len(wc.scalars().all())
        r = AppResponse.model_validate(app)
        r.widget_count = count
        response.append(r)
    return response


@router.post("/apps", response_model=AppResponse, status_code=201)
async def create_app(data: AppCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    app = WorkshopApp(**data.model_dump(), created_by=user.id)
    db.add(app)
    await db.flush()
    await db.refresh(app)
    await create_audit_log(db, user, "create_app", "workshop_app", app.id, {"name": app.name})
    r = AppResponse.model_validate(app)
    r.widget_count = 0
    return r


@router.get("/apps/{app_id}", response_model=AppResponse)
async def get_app(app_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(WorkshopApp).where(WorkshopApp.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    wc = await db.execute(select(WorkshopWidget).where(WorkshopWidget.app_id == app.id))
    r = AppResponse.model_validate(app)
    r.widget_count = len(wc.scalars().all())
    return r


@router.patch("/apps/{app_id}", response_model=AppResponse)
async def update_app(app_id: str, data: AppUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopApp).where(WorkshopApp.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(app, key, value)
    await db.flush()
    await db.refresh(app)
    wc = await db.execute(select(WorkshopWidget).where(WorkshopWidget.app_id == app.id))
    r = AppResponse.model_validate(app)
    r.widget_count = len(wc.scalars().all())
    return r


@router.delete("/apps/{app_id}", status_code=204)
async def delete_app(app_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopApp).where(WorkshopApp.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    await create_audit_log(db, user, "delete_app", "workshop_app", app_id, {"name": app.name})
    await db.delete(app)


@router.post("/apps/{app_id}/publish", response_model=AppResponse)
async def publish_app(app_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopApp).where(WorkshopApp.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    app.is_published = not app.is_published
    await create_audit_log(db, user, "publish_app", "workshop_app", app_id, {"name": app.name, "is_published": app.is_published})
    await db.flush()
    await db.refresh(app)
    wc = await db.execute(select(WorkshopWidget).where(WorkshopWidget.app_id == app.id))
    r = AppResponse.model_validate(app)
    r.widget_count = len(wc.scalars().all())
    return r


# ── Widget CRUD ───────────────────────────────────────

@router.get("/apps/{app_id}/widgets", response_model=list[WidgetResponse])
async def list_widgets(app_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(WorkshopWidget)
        .where(WorkshopWidget.app_id == app_id)
        .order_by(WorkshopWidget.order)
    )
    return result.scalars().all()


@router.post("/apps/{app_id}/widgets", response_model=WidgetResponse, status_code=201)
async def create_widget(app_id: str, data: WidgetCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopApp).where(WorkshopApp.id == app_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="App not found")
    widget = WorkshopWidget(**data.model_dump(), app_id=app_id)
    db.add(widget)
    await db.flush()
    await db.refresh(widget)
    return widget


@router.patch("/widgets/{widget_id}", response_model=WidgetResponse)
async def update_widget(widget_id: str, data: WidgetUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopWidget).where(WorkshopWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(widget, key, value)
    await db.flush()
    await db.refresh(widget)
    return widget


@router.delete("/widgets/{widget_id}", status_code=204)
async def delete_widget(widget_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(WorkshopWidget).where(WorkshopWidget.id == widget_id))
    widget = result.scalar_one_or_none()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    await db.delete(widget)


# ── Batch update widget positions ─────────────────────

class BatchPositionItem(BaseModel):
    id: str
    position: dict


@router.put("/apps/{app_id}/layout", response_model=list[WidgetResponse])
async def update_layout(app_id: str, items: list[BatchPositionItem], db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    for item in items:
        result = await db.execute(select(WorkshopWidget).where(WorkshopWidget.id == item.id, WorkshopWidget.app_id == app_id))
        widget = result.scalar_one_or_none()
        if widget:
            widget.position = item.position
    await db.flush()
    result = await db.execute(
        select(WorkshopWidget).where(WorkshopWidget.app_id == app_id).order_by(WorkshopWidget.order)
    )
    return result.scalars().all()


# ── Resolve data bindings ─────────────────────────────

@router.post("/resolve")
async def resolve_bindings(data: ResolveRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    results = {}
    variables = data.variables or {}
    for w in data.widgets:
        wid = w.get("id", "")
        wtype = w.get("widget_type", "")
        binding = w.get("data_binding", {})
        try:
            results[wid] = await resolve_widget_data(db, wtype, binding or {}, variables)
        except Exception:
            results[wid] = {"error": "Failed to resolve data"}
    return results
