from types import SimpleNamespace

import pytest

from app.services import llm_provider as llm_mod


@pytest.mark.asyncio
async def test_get_llm_client_falls_back_to_active_provider(monkeypatch):
    captured: dict = {}

    class DummyClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    async def _provider_by_id(_db, _provider_id):
        return None

    async def _first_active(_db):
        return SimpleNamespace(
            api_key_encrypted="enc:v1:dummy",
            base_url="https://example.com/v1",
            default_model="qwen-test",
        )

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", DummyClient)
    monkeypatch.setattr(llm_mod, "_get_provider_by_id", _provider_by_id)
    monkeypatch.setattr(llm_mod, "_get_first_active_provider", _first_active)
    monkeypatch.setattr(llm_mod, "decrypt_secret", lambda _v: "provider-key")

    client, model = await llm_mod.get_llm_client(db=object(), provider_id=None)
    assert isinstance(client, DummyClient)
    assert model == "qwen-test"
    assert captured["api_key"] == "provider-key"
    assert captured["base_url"] == "https://example.com/v1"


@pytest.mark.asyncio
async def test_get_llm_client_uses_env_defaults_when_no_provider(monkeypatch):
    captured: dict = {}

    class DummyClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    async def _none_provider(_db, _provider_id=None):
        return None

    monkeypatch.setattr(llm_mod, "AsyncOpenAI", DummyClient)
    monkeypatch.setattr(llm_mod, "_get_provider_by_id", _none_provider)
    monkeypatch.setattr(llm_mod, "_get_first_active_provider", _none_provider)

    old_key = llm_mod.settings.OPENAI_API_KEY
    old_url = llm_mod.settings.OPENAI_BASE_URL
    old_model = llm_mod.settings.DEFAULT_LLM_MODEL

    llm_mod.settings.OPENAI_API_KEY = "env-key"
    llm_mod.settings.OPENAI_BASE_URL = "https://env.example/v1"
    llm_mod.settings.DEFAULT_LLM_MODEL = "env-model"
    try:
        client, model = await llm_mod.get_llm_client(db=object(), provider_id="missing")
    finally:
        llm_mod.settings.OPENAI_API_KEY = old_key
        llm_mod.settings.OPENAI_BASE_URL = old_url
        llm_mod.settings.DEFAULT_LLM_MODEL = old_model

    assert isinstance(client, DummyClient)
    assert model == "env-model"
    assert captured["api_key"] == "env-key"
    assert captured["base_url"] == "https://env.example/v1"
