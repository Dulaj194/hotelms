from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "hotelms-backend"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:5173"

    # ── Database / Cache ─────────────────────────────────────────────────────
    database_url: str = "mysql+pymysql://root:@localhost:3306/hotelms"
    redis_url: str = "redis://localhost:6379"

    # ── JWT / Auth ───────────────────────────────────────────────────────────
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 30

    # ── Rate limiting ────────────────────────────────────────────────────────
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_minutes: int = 15

    # ── File uploads ─────────────────────────────────────────────────────────
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 5

    # ── Guest table sessions + cart ──────────────────────────────────────────
    guest_session_expire_minutes: int = 120   # 2 hours
    cart_ttl_seconds: int = 7200              # matches session default


settings = Settings()
