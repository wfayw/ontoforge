import logging

from pydantic_settings import BaseSettings
from functools import lru_cache

_DEV_SECRET_KEY = "ontoforge-dev-secret-key-change-in-production"
_DEV_ENCRYPTION_KEY = "ontoforge-dev-encryption-key-change-in-production"


class Settings(BaseSettings):
    APP_NAME: str = "OntoForge"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    DATABASE_URL: str = "sqlite+aiosqlite:///./ontoforge.db"
    REDIS_URL: str = ""

    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # AES key for encrypting sensitive configs (data source credentials, LLM API keys)
    ENCRYPTION_KEY: str = ""

    # Default LLM settings
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    DEFAULT_LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT: float = 120.0  # seconds for LLM API request (connect + read)
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    def model_post_init(self, __context) -> None:
        logger = logging.getLogger("uvicorn.error")

        if not self.SECRET_KEY:
            if self.DEBUG:
                self.SECRET_KEY = _DEV_SECRET_KEY
                logger.warning("SECRET_KEY is not set; using development fallback key because DEBUG=True.")
            else:
                raise ValueError("SECRET_KEY must be set when DEBUG=False")

        if not self.ENCRYPTION_KEY:
            if self.DEBUG:
                self.ENCRYPTION_KEY = _DEV_ENCRYPTION_KEY
                logger.warning("ENCRYPTION_KEY is not set; using development fallback key because DEBUG=True.")
            else:
                raise ValueError("ENCRYPTION_KEY must be set when DEBUG=False")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
