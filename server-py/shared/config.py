import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://csuser:localpass@localhost:5432/csdb"

    # JWT Auth
    jwt_secret: str = "your-secret-key-min-32-characters-here"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Device Auth (Ingest API)
    device_key: str = "shared-secret-for-android"

    # Anthropic LLM
    anthropic_api_key: str = ""
    anthropic_model_default: str = "claude-3-haiku-20240307"
    anthropic_model_escalate: str = "claude-3-5-sonnet-20241022"

    # Slack
    slack_webhook_url: str = ""

    # SLA
    sla_threshold_minutes: int = 20

    # Dashboard URL
    dashboard_url: str = "http://localhost:3000"

    # Timezone
    tz: str = "Asia/Seoul"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
