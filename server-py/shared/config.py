import os
import warnings
from pydantic_settings import BaseSettings
from functools import lru_cache

_INSECURE_JWT_DEFAULT = "your-secret-key-min-32-characters-here"
_INSECURE_DEVICE_KEY_DEFAULT = "shared-secret-for-android"


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://csuser:localpass@localhost:5432/csdb"

    # JWT Auth
    jwt_secret: str = _INSECURE_JWT_DEFAULT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # Device Auth (Ingest API)
    device_key: str = _INSECURE_DEVICE_KEY_DEFAULT

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
    settings = Settings()

    is_production = os.environ.get("ENV", "").lower() in ("production", "prod")

    if settings.jwt_secret == _INSECURE_JWT_DEFAULT:
        if is_production:
            raise RuntimeError(
                "FATAL: JWT_SECRET is not configured. "
                "Set the JWT_SECRET environment variable before running in production."
            )
        warnings.warn("JWT_SECRET is using the default value. Set JWT_SECRET env var for production.", stacklevel=2)

    if settings.device_key == _INSECURE_DEVICE_KEY_DEFAULT:
        if is_production:
            raise RuntimeError(
                "FATAL: DEVICE_KEY is not configured. "
                "Set the DEVICE_KEY environment variable before running in production."
            )
        warnings.warn("DEVICE_KEY is using the default value. Set DEVICE_KEY env var for production.", stacklevel=2)

    return settings
