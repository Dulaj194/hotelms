from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ENV_FILE),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "hotelms-backend"
    app_env: str = "development"
    api_v1_prefix: str = "/api/v1"
    frontend_url: str = "http://localhost:5173"

    # Database / Cache
    database_url: str = "mysql+pymysql://root:@localhost:3306/hotelms"
    redis_url: str = "redis://localhost:6379"
    # Legacy fallback for local development only.
    # Keep disabled by default and use Alembic migrations instead.
    db_auto_schema_sync: bool = False

    # JWT / Auth
    secret_key: str = "change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    reset_token_expire_minutes: int = 30
    session_idle_timeout_minutes: int = 60
    session_absolute_timeout_hours: int = 24

    # Rate limiting
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_minutes: int = 15

    # File uploads
    upload_dir: str = "uploads"
    max_upload_size_mb: int = 5

    # Guest table sessions + cart
    guest_session_expire_minutes: int = 120  # 2 hours
    cart_ttl_seconds: int = 7200  # matches session default
    room_session_idle_timeout_minutes: int = 30
    room_qr_key_expire_days: int = 365

    # SaaS subscriptions
    default_trial_days: int = 14
    default_trial_package_code: str = "basic"

    # Stripe billing
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_currency: str = "usd"
    stripe_checkout_success_url: str = (
        "http://localhost:5173/admin/subscription/payment/success"
        "?session_id={CHECKOUT_SESSION_ID}"
    )
    stripe_checkout_cancel_url: str = (
        "http://localhost:5173/admin/subscription/payment/cancel"
    )

    # Email / onboarding notifications
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    smtp_from_email: str = ""
    smtp_from_name: str = "HotelMS"
    frontend_login_url: str = "http://localhost:5173/login"

    @model_validator(mode="after")
    def validate_production_guardrails(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self

        weak_secret_values = {
            "",
            "change-this-in-production",
            "change-this-to-a-long-random-string",
        }
        if self.secret_key in weak_secret_values or len(self.secret_key) < 32:
            raise ValueError(
                "In production, SECRET_KEY must be a strong value with at least 32 characters."
            )
        if self.db_auto_schema_sync:
            raise ValueError(
                "In production, DB_AUTO_SCHEMA_SYNC must be false. Apply Alembic migrations instead."
            )
        return self


settings = Settings()

