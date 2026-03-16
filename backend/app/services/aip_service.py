import json
import logging
import time
import uuid
from typing import Optional, AsyncIterator

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models.aip import AIAgent, AIPFunction, Conversation, LLMProvider
from app.models.ontology import ObjectType, PropertyDefinition, ActionType, LinkType
from app.models.instance import ObjectInstance, LinkInstance
from app.schemas.aip import ChatRequest, ChatResponse, ChatMessage, NLQueryRequest, NLQueryResponse
from app.services.llm_provider import get_llm_client, chat_completion, chat_completion_stream
from app.services.action_executor import execute_action, ActionError
from app.services.analytics_service import aggregate
from app.services.rag_service import search_documents

logger = logging.getLogger("uvicorn.error")

MAX_HISTORY_MESSAGES = 40


ONTOLOGY_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_objects",
            "description": "Search for objects in the ontology by type and/or text query",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_type_name": {"type": "string", "description": "Name of the object type to search"},
                    "query": {"type": "string", "description": "Text search query"},
                    "limit": {"type": "integer", "description": "Max results", "default": 10},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_object_types",
            "description": "List all object types defined in the ontology",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "count_objects",
            "description": "Count objects of a given type, optionally filtered",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_type_name": {"type": "string", "description": "Name of the object type"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "execute_action",
            "description": "Execute an action on an object. First list available actions with list_actions, then call this with the action_type_id and required parameters.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type_id": {"type": "string", "description": "ID of the action type to execute"},
                    "params": {"type": "object", "description": "Parameters required by the action"},
                },
                "required": ["action_type_id", "params"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_actions",
            "description": "List all available action types, optionally filtered by object type name",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_type_name": {"type": "string", "description": "Filter actions by object type name"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "aggregate_objects",
            "description": "Run aggregate analytics on objects: count, sum, avg, min, max, count_distinct. Can group by a property.",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_type_name": {"type": "string", "description": "Name of the object type to aggregate"},
                    "metric": {"type": "string", "enum": ["count", "sum", "avg", "min", "max", "count_distinct"], "description": "Aggregation function"},
                    "property_name": {"type": "string", "description": "Property to aggregate (required for sum/avg/min/max)"},
                    "group_by": {"type": "string", "description": "Property to group by"},
                    "filters": {"type": "object", "description": "Equality filters {property: value}"},
                },
                "required": ["object_type_name", "metric"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_object",
            "description": "Update properties of an existing object instance. Use this to modify object data.",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_id": {"type": "string", "description": "ID of the object to update"},
                    "properties": {"type": "object", "description": "Properties to update {key: new_value}"},
                },
                "required": ["object_id", "properties"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_object",
            "description": "Create a new object instance",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_type_name": {"type": "string", "description": "Name of the object type"},
                    "display_name": {"type": "string", "description": "Display name of the new object"},
                    "properties": {"type": "object", "description": "Object properties {key: value}"},
                },
                "required": ["object_type_name", "properties"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_neighbors",
            "description": "Get objects connected to a specific object via links. Returns neighboring objects and edges.",
            "parameters": {
                "type": "object",
                "properties": {
                    "object_id": {"type": "string", "description": "ID of the object"},
                    "depth": {"type": "integer", "description": "Traversal depth (1-3)", "default": 1},
                },
                "required": ["object_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "document_search",
            "description": "Search uploaded documents (knowledge base) for relevant content. Returns matching text chunks ranked by relevance. Use this to answer questions about uploaded documents, manuals, reports, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query (keywords or natural language)"},
                    "limit": {"type": "integer", "description": "Max results to return", "default": 5},
                },
                "required": ["query"],
            },
        },
    },
]


async def _resolve_type_id(db: AsyncSession, type_name: str) -> Optional[str]:
    result = await db.execute(select(ObjectType).where(ObjectType.name == type_name))
    obj_type = result.scalar_one_or_none()
    return obj_type.id if obj_type else None


async def _execute_tool(db: AsyncSession, name: str, args: dict) -> str:
    """Execute an ontology tool and return the result as a string."""
    if name == "get_object_types":
        result = await db.execute(select(ObjectType))
        types = result.scalars().all()
        return json.dumps([{"name": t.name, "display_name": t.display_name, "description": t.description} for t in types])

    elif name == "search_objects":
        type_name = args.get("object_type_name")
        query_text = args.get("query", "")
        limit = args.get("limit", 10)

        stmt = select(ObjectInstance)
        if type_name:
            type_id = await _resolve_type_id(db, type_name)
            if type_id:
                stmt = stmt.where(ObjectInstance.object_type_id == type_id)

        if query_text:
            pattern = f"%{query_text}%"
            stmt = stmt.where(ObjectInstance.display_name.ilike(pattern))

        stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        objects = result.scalars().all()
        return json.dumps([
            {"id": str(o.id), "display_name": o.display_name, "properties": o.properties}
            for o in objects
        ])

    elif name == "count_objects":
        type_name = args.get("object_type_name")
        stmt = select(func.count(ObjectInstance.id))
        if type_name:
            type_id = await _resolve_type_id(db, type_name)
            if type_id:
                stmt = stmt.where(ObjectInstance.object_type_id == type_id)
        count = (await db.execute(stmt)).scalar()
        return json.dumps({"count": count})

    elif name == "list_actions":
        type_name = args.get("object_type_name")
        stmt = select(ActionType)
        if type_name:
            type_id = await _resolve_type_id(db, type_name)
            if type_id:
                stmt = stmt.where(ActionType.object_type_id == type_id)
        result = await db.execute(stmt)
        actions = result.scalars().all()
        return json.dumps([{
            "id": str(a.id), "name": a.name, "display_name": a.display_name,
            "description": a.description, "parameters": a.parameters, "logic_type": a.logic_type,
        } for a in actions])

    elif name == "execute_action":
        action_type_id = args.get("action_type_id")
        params = args.get("params", {})
        try:
            result = await execute_action(db, action_type_id, params)
            return json.dumps(result)
        except ActionError as e:
            return json.dumps({"error": str(e)})

    elif name == "aggregate_objects":
        type_name = args.get("object_type_name")
        type_id = await _resolve_type_id(db, type_name) if type_name else None
        if not type_id:
            return json.dumps({"error": f"Object type not found: {type_name}"})
        result = await aggregate(
            db, type_id,
            metric=args.get("metric", "count"),
            property_name=args.get("property_name"),
            group_by=args.get("group_by"),
            filters=args.get("filters"),
        )
        return json.dumps(result)

    elif name == "update_object":
        obj_id = args.get("object_id")
        props = args.get("properties", {})
        result = await db.execute(select(ObjectInstance).where(ObjectInstance.id == obj_id))
        obj = result.scalar_one_or_none()
        if not obj:
            return json.dumps({"error": f"Object not found: {obj_id}"})
        obj.properties = {**obj.properties, **props}
        await db.flush()
        await db.refresh(obj)
        return json.dumps({"success": True, "object_id": str(obj.id), "display_name": obj.display_name})

    elif name == "create_object":
        type_name = args.get("object_type_name")
        type_id = await _resolve_type_id(db, type_name) if type_name else None
        if not type_id:
            return json.dumps({"error": f"Object type not found: {type_name}"})
        obj = ObjectInstance(
            object_type_id=type_id,
            display_name=args.get("display_name"),
            properties=args.get("properties", {}),
        )
        db.add(obj)
        await db.flush()
        await db.refresh(obj)
        return json.dumps({"success": True, "object_id": str(obj.id), "display_name": obj.display_name})

    elif name == "get_neighbors":
        obj_id = args.get("object_id")
        depth = min(args.get("depth", 1), 3)
        visited: set[str] = set()
        neighbors = []
        edges = []

        async def traverse(current_id: str, d: int):
            if d > depth or current_id in visited:
                return
            visited.add(current_id)
            links = await db.execute(
                select(LinkInstance).where(
                    (LinkInstance.source_id == current_id) | (LinkInstance.target_id == current_id)
                )
            )
            for link in links.scalars().all():
                other_id = link.target_id if link.source_id == current_id else link.source_id
                edges.append({"source_id": link.source_id, "target_id": link.target_id, "link_type_id": link.link_type_id})
                if other_id not in visited:
                    r = await db.execute(select(ObjectInstance).where(ObjectInstance.id == other_id))
                    o = r.scalar_one_or_none()
                    if o:
                        neighbors.append({"id": str(o.id), "display_name": o.display_name, "properties": o.properties})
                        await traverse(other_id, d + 1)

        await traverse(obj_id, 1)
        return json.dumps({"neighbors": neighbors, "edges": edges})

    elif name == "document_search":
        query_text = args.get("query", "")
        limit = args.get("limit", 5)
        results = await search_documents(db, query=query_text, limit=limit)
        return json.dumps(results)

    return json.dumps({"error": f"Unknown tool: {name}"})


_TOOL_CATEGORY_MAP = {
    "ontology_query": ["get_object_types", "search_objects", "count_objects", "get_neighbors"],
    "action_execute": ["list_actions", "execute_action"],
    "analytics": ["aggregate_objects"],
    "instance_write": ["update_object", "create_object"],
    "document_search": ["document_search"],
}

_TOOL_BY_NAME = {t["function"]["name"]: t for t in ONTOLOGY_TOOLS}


def _resolve_agent_tools(agent_tool_categories: list[str]) -> list[dict]:
    """Map agent tool categories to actual OpenAI-compatible tool definitions."""
    if not agent_tool_categories:
        return []
    names: set[str] = set()
    for cat in agent_tool_categories:
        names.update(_TOOL_CATEGORY_MAP.get(cat, []))
    return [_TOOL_BY_NAME[n] for n in names if n in _TOOL_BY_NAME]


def _sanitize_history(messages: list[dict]) -> list[dict]:
    """Ensure loaded history has valid tool_calls → tool response chains.

    If an assistant message with tool_calls is NOT followed by the required tool
    messages, strip the tool_calls field so the LLM won't reject it.
    """
    result: list[dict] = []
    i = 0
    while i < len(messages):
        msg = messages[i]
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            expected_ids = {tc["id"] for tc in msg["tool_calls"] if isinstance(tc, dict) and "id" in tc}
            # Peek ahead for matching tool messages
            j = i + 1
            found_ids: set[str] = set()
            while j < len(messages) and messages[j].get("role") == "tool":
                tid = messages[j].get("tool_call_id")
                if tid:
                    found_ids.add(tid)
                j += 1
            if expected_ids <= found_ids:
                # Chain is complete — keep as-is
                result.append(msg)
                for k in range(i + 1, j):
                    result.append(messages[k])
                i = j
            else:
                # Broken chain — strip tool_calls, keep only content
                clean = {"role": "assistant", "content": msg.get("content") or ""}
                result.append(clean)
                i += 1
        elif msg.get("role") == "tool":
            # Orphan tool message (its assistant was already cleaned) — skip
            i += 1
        else:
            result.append(msg)
            i += 1
    return result


async def process_chat(db: AsyncSession, data: ChatRequest) -> ChatResponse:
    """Process a chat message, optionally using an agent configuration."""
    system_prompt = "You are OntoForge AI assistant. You help users query and manage their ontology data."
    provider_id = None
    model_name = None
    temperature = 0.7
    tools = ONTOLOGY_TOOLS

    if data.agent_id:
        agent_result = await db.execute(select(AIAgent).where(AIAgent.id == data.agent_id))
        agent = agent_result.scalar_one_or_none()
        if agent:
            system_prompt = agent.system_prompt
            provider_id = str(agent.llm_provider_id) if agent.llm_provider_id else None
            model_name = agent.model_name
            temperature = agent.temperature
            tools = _resolve_agent_tools(agent.tools)

    conv: Optional[Conversation] = None
    if data.conversation_id:
        conv_result = await db.execute(select(Conversation).where(Conversation.id == data.conversation_id))
        conv = conv_result.scalar_one_or_none()

    if not conv:
        conv = Conversation(agent_id=data.agent_id, title=data.message[:100], messages=[])
        db.add(conv)
        await db.flush()

    raw_history = conv.messages[-MAX_HISTORY_MESSAGES:] if len(conv.messages) > MAX_HISTORY_MESSAGES else conv.messages
    history = _sanitize_history(raw_history)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": data.message})

    client, default_model = await get_llm_client(db, provider_id)
    model = model_name or default_model

    t0 = time.monotonic()
    try:
        response = await chat_completion(client, model, messages, tools=tools, temperature=temperature)
        logger.info("LLM call 1 took %.2fs (model=%s, msgs=%d)", time.monotonic() - t0, model, len(messages))
    except Exception as e:
        logger.error("LLM call 1 failed after %.2fs: %s", time.monotonic() - t0, e)
        response = {"role": "assistant", "content": f"LLM call failed: {str(e)}. Please configure a valid LLM provider."}

    # Track all messages produced in this turn for correct history persistence.
    # An assistant message with tool_calls MUST be followed by corresponding tool
    # messages — otherwise the next LLM call will reject the history.
    turn_messages: list[dict] = [{"role": "user", "content": data.message}]

    tool_calls_result = []
    MAX_TOOL_ROUNDS = 5
    round_num = 1
    while "tool_calls" in response and round_num <= MAX_TOOL_ROUNDS:
        turn_messages.append(response)
        messages.append(response)
        for tc in response["tool_calls"]:
            fn_name = tc["function"]["name"]
            fn_args = json.loads(tc["function"]["arguments"])
            t1 = time.monotonic()
            tool_result = await _execute_tool(db, fn_name, fn_args)
            logger.info("Tool %s took %.2fs", fn_name, time.monotonic() - t1)
            tool_calls_result.append({"tool": fn_name, "args": fn_args, "result": json.loads(tool_result)})
            tool_msg = {"role": "tool", "tool_call_id": tc["id"], "content": tool_result}
            messages.append(tool_msg)
            turn_messages.append(tool_msg)

        round_num += 1
        t2 = time.monotonic()
        try:
            response = await chat_completion(client, model, messages, tools=tools, temperature=temperature)
            logger.info("LLM call %d took %.2fs", round_num, time.monotonic() - t2)
        except Exception as e:
            logger.error("LLM call %d failed after %.2fs: %s", round_num, time.monotonic() - t2, e)
            response = {"role": "assistant", "content": f"Tool calling round {round_num} failed: {e}"}
            break

    turn_messages.append(response)
    conv.messages = [*conv.messages, *turn_messages]
    await db.flush()
    await db.refresh(conv)

    return ChatResponse(
        conversation_id=conv.id,
        message=ChatMessage(role=response.get("role", "assistant"), content=response.get("content", "")),
        tool_calls=tool_calls_result,
    )


async def _resolve_provider_id(db: AsyncSession) -> Optional[str]:
    """Find the first active LLM provider as fallback."""
    result = await db.execute(
        select(LLMProvider).where(LLMProvider.is_active == True).limit(1)
    )
    provider = result.scalar_one_or_none()
    return str(provider.id) if provider else None


async def process_nl_query(db: AsyncSession, data: NLQueryRequest) -> NLQueryResponse:
    """Convert natural language to ontology query and execute it."""
    types_result = await db.execute(select(ObjectType))
    all_types = types_result.scalars().all()

    props_desc_parts = []
    for t in all_types:
        prop_result = await db.execute(
            select(PropertyDefinition).where(PropertyDefinition.object_type_id == t.id)
        )
        props = prop_result.scalars().all()
        prop_names = ", ".join(p.name for p in props)
        props_desc_parts.append(
            f"- {t.name} ({t.display_name}): {t.description or ''} [属性: {prop_names}]"
        )
    schema_desc = "\n".join(props_desc_parts)

    system_msg = f"""You are an ontology query translator. Given a natural language query, return a JSON object with:
- "object_type_name": the object type to search (use the name field, e.g. "supplier", "part")
- "search_text": text to search for in object display_name (optional, use empty string if not filtering by text)
- "explanation": brief explanation of the query interpretation in the user's language

Available object types:
{schema_desc}

Return ONLY valid JSON, no markdown fences."""

    provider_id = getattr(data, "provider_id", None) or await _resolve_provider_id(db)
    client, model = await get_llm_client(db, provider_id)
    try:
        result = await chat_completion(
            client, model,
            [{"role": "system", "content": system_msg}, {"role": "user", "content": data.query}],
            temperature=0.1,
        )
        content = result["content"].strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(content)
    except Exception as e:
        logger.warning("NL query LLM failed: %s", e)
        parsed = {"object_type_name": None, "search_text": data.query, "explanation": "Could not parse query, falling back to text search"}

    stmt = select(ObjectInstance)
    if parsed.get("object_type_name"):
        type_r = await db.execute(select(ObjectType).where(ObjectType.name == parsed["object_type_name"]))
        ot = type_r.scalar_one_or_none()
        if ot:
            stmt = stmt.where(ObjectInstance.object_type_id == ot.id)

    search_text = parsed.get("search_text", data.query)
    if search_text:
        pattern = f"%{search_text}%"
        stmt = stmt.where(ObjectInstance.display_name.ilike(pattern))

    stmt = stmt.limit(50)
    objs = (await db.execute(stmt)).scalars().all()

    return NLQueryResponse(
        interpreted_query=parsed.get("explanation", ""),
        results=[{"id": str(o.id), "display_name": o.display_name, "properties": o.properties} for o in objs],
    )


async def execute_aip_function(db: AsyncSession, fn: AIPFunction, inputs: dict) -> dict:
    """Execute an AIP function by filling in the prompt template and calling the LLM."""
    prompt = fn.prompt_template
    for key, value in inputs.items():
        prompt = prompt.replace(f"{{{{{key}}}}}", str(value))

    provider_id = str(fn.llm_provider_id) if fn.llm_provider_id else None
    client, default_model = await get_llm_client(db, provider_id)
    model = fn.model_name or default_model

    try:
        result = await chat_completion(
            client, model,
            [{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return {"output": result["content"]}
    except Exception as e:
        return {"error": str(e)}


async def process_chat_stream(db: AsyncSession, data: ChatRequest) -> AsyncIterator[dict]:
    """Streaming version of process_chat — yields SSE-compatible dicts."""
    system_prompt = "You are OntoForge AI assistant. You help users query and manage their ontology data."
    provider_id = None
    model_name = None
    temperature = 0.7
    tools = ONTOLOGY_TOOLS

    if data.agent_id:
        agent_result = await db.execute(select(AIAgent).where(AIAgent.id == data.agent_id))
        agent = agent_result.scalar_one_or_none()
        if agent:
            system_prompt = agent.system_prompt
            provider_id = str(agent.llm_provider_id) if agent.llm_provider_id else None
            model_name = agent.model_name
            temperature = agent.temperature
            tools = _resolve_agent_tools(agent.tools)

    conv_id: str
    messages_so_far: list
    conv: Optional[Conversation] = None
    if data.conversation_id:
        conv_result = await db.execute(select(Conversation).where(Conversation.id == data.conversation_id))
        conv = conv_result.scalar_one_or_none()
        if conv:
            conv_id = conv.id
            messages_so_far = list(conv.messages)
        else:
            conv_id = data.conversation_id
            messages_so_far = []
    else:
        # 使用独立短会话创建 conversation，避免长时间占用连接导致 SQLite database is locked
        async with async_session() as sess:
            new_conv = Conversation(agent_id=data.agent_id, title=data.message[:100], messages=[])
            sess.add(new_conv)
            await sess.commit()
            conv_id = new_conv.id
        messages_so_far = []

    yield {"type": "conversation_id", "conversation_id": conv_id}

    raw_history = messages_so_far[-MAX_HISTORY_MESSAGES:] if len(messages_so_far) > MAX_HISTORY_MESSAGES else messages_so_far
    history = _sanitize_history(raw_history)
    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": data.message})

    client, default_model = await get_llm_client(db, provider_id)
    model = model_name or default_model

    turn_messages: list[dict] = [{"role": "user", "content": data.message}]
    tool_calls_result: list[dict] = []

    MAX_TOOL_ROUNDS = 5
    round_num = 0

    while round_num < MAX_TOOL_ROUNDS:
        round_num += 1
        content_buf = ""
        finish_tool_calls = None

        try:
            async for delta in chat_completion_stream(client, model, messages, tools=tools, temperature=temperature):
                if delta["type"] == "content_delta":
                    content_buf += delta["content"]
                    yield {"type": "content_delta", "content": delta["content"]}
                elif delta["type"] == "finish":
                    finish_tool_calls = delta.get("tool_calls")
        except Exception as e:
            logger.error("Streaming LLM call %d failed: %s", round_num, e)
            error_msg = f"LLM call failed: {e}"
            yield {"type": "content_delta", "content": error_msg}
            content_buf = error_msg
            finish_tool_calls = None

        if finish_tool_calls and any(tc.get("name") for tc in finish_tool_calls):
            assistant_msg: dict = {"role": "assistant", "content": content_buf or ""}
            assistant_msg["tool_calls"] = [
                {"id": tc["id"], "function": {"name": tc["name"], "arguments": tc["arguments"]}}
                for tc in finish_tool_calls if tc.get("name")
            ]
            turn_messages.append(assistant_msg)
            messages.append(assistant_msg)

            for tc in assistant_msg["tool_calls"]:
                fn_name = tc["function"]["name"]
                try:
                    fn_args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    fn_args = {}

                yield {"type": "tool_start", "tool": fn_name, "args": fn_args}

                tool_result = await _execute_tool(db, fn_name, fn_args)
                tool_parsed = json.loads(tool_result)
                tool_calls_result.append({"tool": fn_name, "args": fn_args, "result": tool_parsed})

                yield {"type": "tool_end", "tool": fn_name, "result": tool_parsed}

                tool_msg = {"role": "tool", "tool_call_id": tc["id"], "content": tool_result}
                messages.append(tool_msg)
                turn_messages.append(tool_msg)
        else:
            assistant_msg_final = {"role": "assistant", "content": content_buf}
            turn_messages.append(assistant_msg_final)
            break

    # 使用独立短会话更新 conversation，避免请求级 session 长时间持锁导致 SQLite database is locked
    final_messages = [*messages_so_far, *turn_messages]
    async with async_session() as sess:
        result = await sess.execute(select(Conversation).where(Conversation.id == conv_id))
        conv_to_update = result.scalar_one_or_none()
        if conv_to_update:
            conv_to_update.messages = final_messages
            await sess.commit()

    yield {"type": "done", "tool_calls": tool_calls_result}
