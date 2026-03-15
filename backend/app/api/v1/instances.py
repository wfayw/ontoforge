from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.instance import ObjectInstance, LinkInstance
from app.models.ontology import ObjectType
from app.models.data_integration import Pipeline, PipelineRun, DataSource
from app.schemas.instance import (
    ObjectInstanceCreate, ObjectInstanceUpdate, ObjectInstanceResponse,
    LinkInstanceCreate, LinkInstanceResponse,
)
from app.services.auth_service import get_current_user
from app.services.action_executor import execute_action, ActionError
from app.services.analytics_service import aggregate

router = APIRouter()


# ── Object Instances ──────────────────────────────────────────

@router.get("/objects", response_model=dict)
async def list_objects(
    object_type_id: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(ObjectInstance)
    count_query = select(func.count(ObjectInstance.id))

    if object_type_id:
        query = query.where(ObjectInstance.object_type_id == object_type_id)
        count_query = count_query.where(ObjectInstance.object_type_id == object_type_id)

    if q:
        like_pattern = f"%{q}%"
        query = query.where(ObjectInstance.display_name.ilike(like_pattern))
        count_query = count_query.where(ObjectInstance.display_name.ilike(like_pattern))

    total = (await db.execute(count_query)).scalar()
    query = query.order_by(ObjectInstance.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "items": [ObjectInstanceResponse.model_validate(i) for i in items],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/objects", response_model=ObjectInstanceResponse, status_code=201)
async def create_object(data: ObjectInstanceCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    type_check = await db.execute(select(ObjectType).where(ObjectType.id == data.object_type_id))
    if not type_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Object type not found")

    obj = ObjectInstance(**data.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.get("/objects/{obj_id}", response_model=ObjectInstanceResponse)
async def get_object(obj_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == obj_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    return obj


@router.patch("/objects/{obj_id}", response_model=ObjectInstanceResponse)
async def update_object(obj_id: str, data: ObjectInstanceUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == obj_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    if data.display_name is not None:
        obj.display_name = data.display_name
    if data.properties is not None:
        merged = {**obj.properties, **data.properties}
        obj.properties = merged
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/objects/{obj_id}", status_code=204)
async def delete_object(obj_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == obj_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    await db.delete(obj)


# ── Link Instances ────────────────────────────────────────────

@router.get("/links", response_model=list[LinkInstanceResponse])
async def list_links(
    link_type_id: Optional[str] = None,
    source_id: Optional[str] = None,
    target_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(LinkInstance)
    if link_type_id:
        query = query.where(LinkInstance.link_type_id == link_type_id)
    if source_id:
        query = query.where(LinkInstance.source_id == source_id)
    if target_id:
        query = query.where(LinkInstance.target_id == target_id)
    result = await db.execute(query.order_by(LinkInstance.created_at.desc()))
    return result.scalars().all()


@router.post("/links", response_model=LinkInstanceResponse, status_code=201)
async def create_link(data: LinkInstanceCreate, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    link = LinkInstance(**data.model_dump())
    db.add(link)
    await db.flush()
    await db.refresh(link)
    return link


@router.delete("/links/{link_id}", status_code=204)
async def delete_link(link_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(LinkInstance).where(LinkInstance.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    await db.delete(link)


# ── Graph Query ───────────────────────────────────────────────

@router.get("/objects/{obj_id}/neighbors")
async def get_neighbors(obj_id: str, depth: int = Query(1, ge=1, le=3), db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Get neighboring objects connected via links (up to specified depth)."""
    visited = set()
    neighbors = []
    edges = []

    async def traverse(current_id: str, current_depth: int):
        if current_depth > depth or current_id in visited:
            return
        visited.add(current_id)

        links = await db.execute(
            select(LinkInstance).where(
                (LinkInstance.source_id == current_id) | (LinkInstance.target_id == current_id)
            )
        )
        for link in links.scalars().all():
            other_id = link.target_id if link.source_id == current_id else link.source_id
            edges.append({
                "id": str(link.id),
                "link_type_id": str(link.link_type_id),
                "source_id": str(link.source_id),
                "target_id": str(link.target_id),
            })
            if other_id not in visited:
                obj_result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == other_id))
                obj = obj_result.scalar_one_or_none()
                if obj:
                    neighbors.append(ObjectInstanceResponse.model_validate(obj).model_dump())
                    await traverse(other_id, current_depth + 1)

    await traverse(obj_id, 1)
    return {"neighbors": neighbors, "edges": edges}


# ── Action Execution ─────────────────────────────────────────

class ActionExecuteRequest(BaseModel):
    action_type_id: str
    params: dict = {}
    dry_run: bool = False


@router.post("/actions/execute")
async def execute_action_endpoint(
    data: ActionExecuteRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    try:
        result = await execute_action(db, data.action_type_id, data.params, dry_run=data.dry_run)
        return result
    except ActionError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Aggregate / Analytics ────────────────────────────────────

class AggregateRequest(BaseModel):
    object_type_id: str
    metric: str = "count"
    property_name: Optional[str] = None
    group_by: Optional[str] = None
    time_granularity: Optional[str] = None
    date_property: Optional[str] = None
    filters: Optional[dict] = None


@router.post("/objects/aggregate")
async def aggregate_endpoint(
    data: AggregateRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await aggregate(
        db,
        data.object_type_id,
        metric=data.metric,
        property_name=data.property_name,
        group_by=data.group_by,
        time_granularity=data.time_granularity,
        date_property=data.date_property,
        filters=data.filters,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ── Data Lineage ─────────────────────────────────────────────

@router.get("/objects/{obj_id}/lineage")
async def get_lineage(obj_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Return the data provenance chain for an object: data_source → pipeline → run → object."""
    result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == obj_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")

    lineage: dict = {
        "object_id": obj.id,
        "display_name": obj.display_name,
        "source_pipeline_id": obj.source_pipeline_id,
        "source_run_id": obj.source_run_id,
        "source_row_index": obj.source_row_index,
    }

    if obj.source_pipeline_id:
        pl_result = await db.execute(select(Pipeline).where(Pipeline.id == obj.source_pipeline_id))
        pl = pl_result.scalar_one_or_none()
        if pl:
            lineage["pipeline"] = {"id": pl.id, "name": pl.name, "source_id": pl.source_id}
            ds_result = await db.execute(select(DataSource).where(DataSource.id == pl.source_id))
            ds = ds_result.scalar_one_or_none()
            if ds:
                lineage["data_source"] = {"id": ds.id, "name": ds.name, "source_type": ds.source_type}

    if obj.source_run_id:
        run_result = await db.execute(select(PipelineRun).where(PipelineRun.id == obj.source_run_id))
        run = run_result.scalar_one_or_none()
        if run:
            lineage["pipeline_run"] = {
                "id": run.id,
                "status": run.status,
                "rows_processed": run.rows_processed,
                "started_at": run.started_at.isoformat() if run.started_at else None,
            }

    return lineage
