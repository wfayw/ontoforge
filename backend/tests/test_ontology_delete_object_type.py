from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.ontology import delete_object_type
from app.database import Base
from app.models import ontology as ontology_models  # noqa: F401
from app.models import user as user_models  # noqa: F401
from app.models import audit_log as audit_log_models  # noqa: F401
from app.models.data_integration import DataSource, Pipeline
from app.models.ontology import ActionType, LinkType, ObjectType
from app.models.user import User


@pytest.mark.asyncio
async def test_delete_object_type_cleans_related_links_actions_and_pipelines(tmp_path: Path):
    db_path = tmp_path / "ontology-delete.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        user = User(
            username="editor",
            email="editor@example.com",
            hashed_password="hashed",
            role="editor",
        )
        source_type = ObjectType(name="supplier", display_name="Supplier")
        target_type = ObjectType(name="order", display_name="Order")
        data_source = DataSource(
            name="orders_csv",
            source_type="csv",
            connection_config={},
        )
        session.add_all([user, source_type, target_type, data_source])
        await session.flush()

        session.add(
            LinkType(
                name="supplier_to_order",
                display_name="Supplies",
                source_type_id=source_type.id,
                target_type_id=target_type.id,
            )
        )
        session.add(
            ActionType(
                name="archive_order",
                display_name="Archive Order",
                object_type_id=target_type.id,
                parameters={},
                logic_config={},
                side_effects=[],
            )
        )
        session.add(
            Pipeline(
                name="orders_pipeline",
                source_id=data_source.id,
                target_object_type_id=target_type.id,
                field_mappings={},
                transform_steps=[],
            )
        )
        await session.commit()

    async with Session() as session:
        user = await session.scalar(select(User).where(User.username == "editor"))
        target_type = await session.scalar(select(ObjectType).where(ObjectType.name == "order"))

        await delete_object_type(target_type.id, db=session, user=user)
        await session.commit()

        remaining_types = await session.scalar(select(func.count()).select_from(ObjectType))
        remaining_links = await session.scalar(select(func.count()).select_from(LinkType))
        remaining_actions = await session.scalar(select(func.count()).select_from(ActionType))
        remaining_pipelines = await session.scalar(select(func.count()).select_from(Pipeline))

        assert remaining_types == 1
        assert remaining_links == 0
        assert remaining_actions == 0
        assert remaining_pipelines == 0

    await engine.dispose()
