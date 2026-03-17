import logging

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # 等待锁的最长时间（秒），减轻并发写入时的 "database is locked"
    connect_args["timeout"] = 30

engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, future=True, connect_args=connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
logger = logging.getLogger("uvicorn.error")


async def init_sqlite_pragma():
    """启动时对 SQLite 启用 WAL 与 busy_timeout，缓解并发时的 database is locked."""
    if not settings.DATABASE_URL.startswith("sqlite"):
        return
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=30000"))


async def ensure_schema_compatibility():
    """Apply lightweight compatibility migrations for existing deployments."""
    async with engine.begin() as conn:
        table_names = await conn.run_sync(lambda sync_conn: set(inspect(sync_conn).get_table_names()))
        if "conversations" not in table_names:
            return

        columns = await conn.run_sync(
            lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("conversations")}
        )
        if "user_id" not in columns:
            await conn.execute(text("ALTER TABLE conversations ADD COLUMN user_id VARCHAR(36)"))
            logger.info("Added conversations.user_id compatibility column")

        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations (user_id)")
        )

        if "users" not in table_names:
            return

        null_user_count = await conn.scalar(
            text("SELECT COUNT(*) FROM conversations WHERE user_id IS NULL")
        )
        if not null_user_count:
            return

        user_count = await conn.scalar(text("SELECT COUNT(*) FROM users"))
        if user_count == 1:
            only_user_id = await conn.scalar(text("SELECT id FROM users LIMIT 1"))
            await conn.execute(
                text("UPDATE conversations SET user_id = :user_id WHERE user_id IS NULL"),
                {"user_id": only_user_id},
            )
            logger.info("Backfilled %d conversations to single user %s", null_user_count, only_user_id)
        else:
            logger.warning(
                "Found %d legacy conversations without user_id. Please run manual migration.",
                null_user_count,
            )

        if "action_types" in table_names:
            action_cols = await conn.run_sync(
                lambda sync_conn: {col["name"] for col in inspect(sync_conn).get_columns("action_types")}
            )
            if "side_effects" not in action_cols:
                await conn.execute(
                    text("ALTER TABLE action_types ADD COLUMN side_effects JSON DEFAULT '[]'")
                )
                logger.info("Added action_types.side_effects compatibility column")


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
