"""Pipeline scheduler using APScheduler — cron and interval triggers."""

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.database import async_session
from app.models.data_integration import Pipeline

logger = logging.getLogger("uvicorn.error")

_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


def _build_trigger(config: dict):
    stype = config.get("type", "cron")
    if stype == "cron":
        return CronTrigger.from_crontab(config.get("cron", "0 * * * *"))
    elif stype == "interval":
        return IntervalTrigger(
            seconds=config.get("seconds", 0),
            minutes=config.get("minutes", 0),
            hours=config.get("hours", 0),
        )
    raise ValueError(f"Unknown schedule type: {stype}")


async def _run_pipeline_job(pipeline_id: str):
    """Execute a pipeline inside an independent DB session."""
    from app.services.pipeline_executor import execute_pipeline

    async with async_session() as db:
        try:
            result = await db.execute(select(Pipeline).where(Pipeline.id == pipeline_id))
            pipeline = result.scalar_one_or_none()
            if not pipeline:
                logger.warning("Scheduled pipeline %s not found, removing job", pipeline_id)
                remove_pipeline(pipeline_id)
                return
            run = await execute_pipeline(db, pipeline)
            await db.commit()
            logger.info(
                "Scheduled run for pipeline '%s': %s (%d rows)",
                pipeline.name, run.status, run.rows_processed,
            )
        except Exception as e:
            await db.rollback()
            logger.error("Scheduled pipeline %s failed: %s", pipeline_id, e)


def add_pipeline(pipeline_id: str, config: dict):
    scheduler = get_scheduler()
    job_id = f"pipeline_{pipeline_id}"
    try:
        trigger = _build_trigger(config)
    except Exception as e:
        logger.error("Invalid schedule config for %s: %s", pipeline_id, e)
        return
    scheduler.add_job(
        _run_pipeline_job,
        trigger=trigger,
        args=[pipeline_id],
        id=job_id,
        replace_existing=True,
        name=f"Pipeline {pipeline_id}",
    )
    logger.info("Scheduled pipeline %s with config %s", pipeline_id, config)


def remove_pipeline(pipeline_id: str):
    scheduler = get_scheduler()
    job_id = f"pipeline_{pipeline_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info("Removed schedule for pipeline %s", pipeline_id)


def list_jobs() -> list[dict]:
    scheduler = get_scheduler()
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger),
        })
    return jobs


async def startup_load_schedules():
    """Load all active pipeline schedules from DB on startup."""
    async with async_session() as db:
        try:
            result = await db.execute(
                select(Pipeline).where(Pipeline.schedule_config.isnot(None))
            )
            pipelines = result.scalars().all()
            for pipeline in pipelines:
                if pipeline.schedule_config:
                    add_pipeline(pipeline.id, pipeline.schedule_config)
        finally:
            await db.close()
    logger.info("Scheduler loaded existing pipeline schedules")
