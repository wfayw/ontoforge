from typing import Optional, AsyncIterator
import json

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.aip import LLMProvider
from app.services.security import decrypt_secret

settings = get_settings()


def _timeout_seconds() -> float:
    return getattr(settings, "LLM_TIMEOUT", 120.0)


async def get_llm_client(db: AsyncSession, provider_id: Optional[str] = None) -> tuple[AsyncOpenAI, str]:
    """Get an OpenAI-compatible async client for the given provider, or use defaults."""
    timeout = _timeout_seconds()
    if provider_id:
        result = await db.execute(select(LLMProvider).where(LLMProvider.id == provider_id))
        provider = result.scalar_one_or_none()
        if provider:
            client = AsyncOpenAI(
                api_key=decrypt_secret(provider.api_key_encrypted or "") or "sk-placeholder",
                base_url=provider.base_url,
                timeout=timeout,
            )
            return client, provider.default_model

    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY or "sk-placeholder",
        base_url=settings.OPENAI_BASE_URL,
        timeout=timeout,
    )
    return client, settings.DEFAULT_LLM_MODEL


async def chat_completion(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    temperature: float = 0.7,
) -> dict:
    """Call the LLM chat completion API."""
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    response = await client.chat.completions.create(**kwargs)
    choice = response.choices[0]

    result = {
        "role": "assistant",
        "content": choice.message.content or "",
    }
    if choice.message.tool_calls:
        result["tool_calls"] = [
            {
                "id": tc.id,
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments,
                },
            }
            for tc in choice.message.tool_calls
        ]
    return result


async def chat_completion_stream(
    client: AsyncOpenAI,
    model: str,
    messages: list[dict],
    tools: Optional[list[dict]] = None,
    temperature: float = 0.7,
) -> AsyncIterator[dict]:
    """Streaming chat completion — yields delta dicts.

    Each yielded dict has one of:
      {"type": "content_delta", "content": "..."}
      {"type": "tool_call_delta", "index": N, "id": "...", "name": "...", "arguments_delta": "..."}
      {"type": "finish", "finish_reason": "..."}
    """
    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    stream = await client.chat.completions.create(**kwargs)

    tc_buffers: dict[int, dict] = {}

    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        finish_reason = chunk.choices[0].finish_reason if chunk.choices else None

        if delta and delta.content:
            yield {"type": "content_delta", "content": delta.content}

        if delta and delta.tool_calls:
            for tc_delta in delta.tool_calls:
                idx = tc_delta.index
                if idx not in tc_buffers:
                    tc_buffers[idx] = {"id": "", "name": "", "arguments": ""}
                if tc_delta.id:
                    tc_buffers[idx]["id"] = tc_delta.id
                if tc_delta.function:
                    if tc_delta.function.name:
                        tc_buffers[idx]["name"] = tc_delta.function.name
                    if tc_delta.function.arguments:
                        tc_buffers[idx]["arguments"] += tc_delta.function.arguments

        if finish_reason:
            yield {"type": "finish", "finish_reason": finish_reason, "tool_calls": list(tc_buffers.values()) if tc_buffers else None}
            break
