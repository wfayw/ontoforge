import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.aip import LLMProvider, AIAgent, AIPFunction, Conversation
from app.schemas.aip import (
    LLMProviderCreate, LLMProviderResponse, LLMProviderUpdate,
    AIAgentCreate, AIAgentUpdate, AIAgentResponse,
    AIPFunctionCreate, AIPFunctionResponse, AIPFunctionUpdate,
    ChatRequest, ChatResponse, ConversationResponse,
    NLQueryRequest, NLQueryResponse,
)
from app.services.auth_service import get_current_user, require_editor
from app.services.audit_service import create_audit_log
from app.services.aip_service import process_chat, process_chat_stream, process_nl_query, execute_aip_function
from app.services.security import encrypt_secret

router = APIRouter()


# ── LLM Providers ────────────────────────────────────────────

@router.get("/providers", response_model=list[LLMProviderResponse])
async def list_providers(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(LLMProvider).order_by(LLMProvider.created_at.desc()))
    return result.scalars().all()


@router.post("/providers", response_model=LLMProviderResponse, status_code=201)
async def create_provider(data: LLMProviderCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    provider = LLMProvider(
        name=data.name,
        provider_type=data.provider_type,
        base_url=data.base_url,
        api_key_encrypted=encrypt_secret(data.api_key or ""),
        default_model=data.default_model,
    )
    db.add(provider)
    await db.flush()
    await db.refresh(provider)
    await create_audit_log(db, user, "create_provider", "llm_provider", provider.id, {"name": provider.name})
    return provider


@router.delete("/providers/{provider_id}", status_code=204)
async def delete_provider(provider_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    await create_audit_log(db, user, "delete_provider", "llm_provider", provider_id, {"name": p.name})
    await db.delete(p)


@router.patch("/providers/{provider_id}", response_model=LLMProviderResponse)
async def update_provider(provider_id: str, data: LLMProviderUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Provider not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "api_key":
            p.api_key_encrypted = encrypt_secret(value or "")
        else:
            setattr(p, field, value)
    await db.flush()
    await db.refresh(p)
    return p


# ── AI Agents ─────────────────────────────────────────────────

@router.get("/agents", response_model=list[AIAgentResponse])
async def list_agents(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AIAgent).order_by(AIAgent.created_at.desc()))
    return result.scalars().all()


@router.post("/agents", response_model=AIAgentResponse, status_code=201)
async def create_agent(data: AIAgentCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    agent = AIAgent(**data.model_dump())
    db.add(agent)
    await db.flush()
    await db.refresh(agent)
    await create_audit_log(db, user, "create_agent", "ai_agent", agent.id, {"name": agent.name})
    return agent


@router.get("/agents/{agent_id}", response_model=AIAgentResponse)
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AIAgent).where(AIAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/agents/{agent_id}", response_model=AIAgentResponse)
async def update_agent(agent_id: str, data: AIAgentUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(AIAgent).where(AIAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(agent, field, value)
    await db.flush()
    await db.refresh(agent)
    return agent


@router.delete("/agents/{agent_id}", status_code=204)
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(AIAgent).where(AIAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await create_audit_log(db, user, "delete_agent", "ai_agent", agent_id, {"name": agent.name})
    await db.delete(agent)


# ── AIP Functions ─────────────────────────────────────────────

@router.get("/functions", response_model=list[AIPFunctionResponse])
async def list_functions(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AIPFunction).order_by(AIPFunction.created_at.desc()))
    return result.scalars().all()


@router.post("/functions", response_model=AIPFunctionResponse, status_code=201)
async def create_function(data: AIPFunctionCreate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    fn = AIPFunction(**data.model_dump())
    db.add(fn)
    await db.flush()
    await db.refresh(fn)
    await create_audit_log(db, user, "create_function", "aip_function", fn.id, {"name": fn.name})
    return fn


@router.post("/functions/{func_id}/execute")
async def run_function(func_id: str, inputs: dict, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(AIPFunction).where(AIPFunction.id == func_id))
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found")
    return await execute_aip_function(db, fn, inputs)


@router.patch("/functions/{func_id}", response_model=AIPFunctionResponse)
async def update_function(func_id: str, data: AIPFunctionUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(AIPFunction).where(AIPFunction.id == func_id))
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(fn, field, value)
    await db.flush()
    await db.refresh(fn)
    return fn


@router.delete("/functions/{func_id}", status_code=204)
async def delete_function(func_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_editor)):
    result = await db.execute(select(AIPFunction).where(AIPFunction.id == func_id))
    fn = result.scalar_one_or_none()
    if not fn:
        raise HTTPException(status_code=404, detail="Function not found")
    await create_audit_log(db, user, "delete_function", "aip_function", func_id, {"name": fn.name})
    await db.delete(fn)


# ── Chat & Conversations ─────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(data: ChatRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return await process_chat(db, data, user)


@router.post("/chat/stream")
async def chat_stream(data: ChatRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    async def generate():
        async for chunk in process_chat_stream(db, data, user):
            yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.get("/conversations/{conv_id}", response_model=ConversationResponse)
async def get_conversation(conv_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == user.id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


# ── Natural Language Query ────────────────────────────────────

@router.post("/nl-query", response_model=NLQueryResponse)
async def nl_query(data: NLQueryRequest, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    return await process_nl_query(db, data)
