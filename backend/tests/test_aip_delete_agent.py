from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.api.v1.aip import delete_agent
from app.database import Base
from app.models import aip as aip_models  # noqa: F401
from app.models import audit_log as audit_log_models  # noqa: F401
from app.models import user as user_models  # noqa: F401
from app.models.aip import AIAgent, Conversation
from app.models.user import User


@pytest.mark.asyncio
async def test_delete_agent_preserves_conversations_by_nulling_agent_id(tmp_path: Path):
    db_path = tmp_path / "aip-delete-agent.db"
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
        agent = AIAgent(
            name="Supply Chain Analyst",
            system_prompt="Help with supply chain analysis",
            tools=["ontology_query"],
        )
        session.add_all([user, agent])
        await session.flush()

        conversation = Conversation(
            agent_id=agent.id,
            user_id=user.id,
            title="Investigate delays",
            messages=[{"role": "user", "content": "Why are deliveries late?"}],
        )
        session.add(conversation)
        await session.commit()

    async with Session() as session:
        user = await session.scalar(select(User).where(User.username == "editor"))
        agent = await session.scalar(select(AIAgent).where(AIAgent.name == "Supply Chain Analyst"))

        await delete_agent(agent.id, db=session, user=user)
        await session.commit()

        remaining_agent = await session.scalar(select(AIAgent).where(AIAgent.id == agent.id))
        preserved_conversation = await session.scalar(select(Conversation).where(Conversation.title == "Investigate delays"))

        assert remaining_agent is None
        assert preserved_conversation is not None
        assert preserved_conversation.agent_id is None

    await engine.dispose()
