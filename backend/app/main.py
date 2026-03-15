import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base, init_sqlite_pragma
from app.api.v1 import router as api_router

settings = get_settings()

logging.getLogger("ontoforge").setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_sqlite_pragma()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    from app.services.scheduler import get_scheduler, startup_load_schedules
    sched = get_scheduler()
    if not sched.running:
        sched.start(paused=False)

    import asyncio
    asyncio.get_event_loop().create_task(_load_schedules_bg())

    yield

    if sched.running:
        sched.shutdown(wait=False)
    await engine.dispose()


async def _load_schedules_bg():
    import asyncio
    await asyncio.sleep(1)
    try:
        from app.services.scheduler import startup_load_schedules
        await startup_load_schedules()
    except Exception as e:
        logging.getLogger("uvicorn.error").warning("Failed to load schedules: %s", e)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="OntoForge — Open-source data operations platform with Ontology, Data Integration, and AI capabilities.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
