from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.data_integration import Pipeline, PipelineRun
from app.schemas.data_integration import (
    PipelineCreate, PipelineUpdate, PipelineResponse, PipelineRunResponse,
    ScheduleRequest,
)
from app.services.auth_service import get_current_user, require_editor
from app.services.audit_service import create_audit_log
from app.services.pipeline_executor import execute_pipeline
from app.services import scheduler as sched

router = APIRouter()


@router.get("/", response_model=list[PipelineResponse])
async def list_pipelines(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Pipeline).order_by(Pipeline.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=PipelineResponse, status_code=201)
async def create_pipeline(data: PipelineCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    pipeline = Pipeline(**data.model_dump())
    db.add(pipeline)
    await db.flush()
    await db.refresh(pipeline)
    await create_audit_log(db, user, "create", "pipeline", pipeline.id, {"name": data.name})
    return pipeline


@router.get("/scheduler/status")
async def scheduler_status(_: User = Depends(get_current_user)):
    s = sched.get_scheduler()
    return {
        "running": s.running,
        "jobs": sched.list_jobs(),
    }


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return p


@router.patch("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(pipeline_id: str, data: PipelineUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    await db.flush()
    await db.refresh(p)
    return p


@router.delete("/{pipeline_id}", status_code=204)
async def delete_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    await create_audit_log(db, user, "delete", "pipeline", pipeline_id)
    sched.remove_pipeline(pipeline_id)
    await db.delete(p)


@router.post("/{pipeline_id}/run", response_model=PipelineRunResponse)
async def run_pipeline(pipeline_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    run = await execute_pipeline(db, p)
    await create_audit_log(db, user, "run", "pipeline", pipeline_id)
    return run


@router.get("/{pipeline_id}/runs", response_model=list[PipelineRunResponse])
async def list_pipeline_runs(pipeline_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(
        select(PipelineRun).where(PipelineRun.pipeline_id == pipeline_id).order_by(PipelineRun.created_at.desc())
    )
    return result.scalars().all()


@router.put("/{pipeline_id}/schedule")
async def set_schedule(
    pipeline_id: str,
    body: ScheduleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    config = body.model_dump(exclude_none=True)
    p.schedule_config = config
    await db.flush()

    sched.add_pipeline(pipeline_id, config)

    s = sched.get_scheduler()
    job = s.get_job(f"pipeline_{pipeline_id}")
    return {
        "pipeline_id": pipeline_id,
        "schedule_config": config,
        "next_run_time": job.next_run_time.isoformat() if job and job.next_run_time else None,
    }


@router.delete("/{pipeline_id}/schedule", status_code=204)
async def remove_schedule(
    pipeline_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_editor),
):
    result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    p.schedule_config = None
    await db.flush()
    sched.remove_pipeline(pipeline_id)
