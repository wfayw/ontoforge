from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "OntoForge"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite+aiosqlite:///./ontoforge.db"
    REDIS_URL: str = ""

    SECRET_KEY: str = "ontoforge-dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # AES key for encrypting sensitive configs (data source credentials, LLM API keys)
    ENCRYPTION_KEY: str = "ontoforge-encryption-key-32bytes!"

    # Default LLM settings
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT: float = 120.0  # seconds for LLM API request (connect + read)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
