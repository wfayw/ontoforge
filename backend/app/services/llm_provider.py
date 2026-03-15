from typing import Optional
import json

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.aip import LLMProvider

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
                api_key=provider.api_key_encrypted or "sk-placeholder",
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
