import re
from pathlib import Path

from pydantic import field_validator, model_validator
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
    # Comma-separated list of allowed frontend origins for CORS.
    # Example: http://localhost:5173,http://192.168.43.199:5173
    frontend_urls: str = ""

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
    secure_cookies: bool = True

    # Rate limiting
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_minutes: int = 15
    registration_rate_limit_attempts: int = 3
    registration_rate_limit_window_minutes: int = 30
    password_reset_rate_limit_attempts: int = 3
    password_reset_rate_limit_window_minutes: int = 30

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

    # SMS notifications (Twilio)
    sms_enabled: bool = False
    sms_provider: str = "twilio"
    sms_default_country_code: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    @field_validator("sms_provider", mode="before")
    @classmethod
    def normalize_sms_provider(cls, value: object) -> str:
        if value is None:
            return "twilio"
        return str(value).strip().lower()

    @field_validator("sms_default_country_code", mode="before")
    @classmethod
    def normalize_sms_default_country_code(cls, value: object) -> str:
        if value is None:
            return ""
        normalized = str(value).strip()
        if not normalized:
            return ""
        if normalized.startswith("+"):
            return normalized
        return f"+{normalized}"

    @field_validator("twilio_from_number", mode="before")
    @classmethod
    def normalize_twilio_from_number(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

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

    @model_validator(mode="after")
    def validate_sms_configuration(self) -> "Settings":
        if not self.sms_enabled:
            return self

        if self.sms_provider != "twilio":
            raise ValueError(
                "When SMS_ENABLED=true, SMS_PROVIDER must be 'twilio'."
            )

        missing_fields: list[str] = []
        if not self.twilio_account_sid:
            missing_fields.append("TWILIO_ACCOUNT_SID")
        if not self.twilio_auth_token:
            missing_fields.append("TWILIO_AUTH_TOKEN")
        if not self.twilio_from_number:
            missing_fields.append("TWILIO_FROM_NUMBER")

        if missing_fields:
            raise ValueError(
                "When SMS_ENABLED=true, these fields are required: "
                + ", ".join(missing_fields)
            )

        if not self.twilio_account_sid.startswith("AC"):
            raise ValueError(
                "TWILIO_ACCOUNT_SID must start with 'AC'."
            )

        if not re.fullmatch(r"\+\d{8,15}", self.twilio_from_number):
            raise ValueError(
                "TWILIO_FROM_NUMBER must be in E.164 format (e.g., +14155552671)."
            )

        return self

    @model_validator(mode="after")
    def validate_required_environment_variables(self) -> "Settings":
        """Fail fast if critical environment variables are missing or using defaults."""
        # In production, reject weak defaults
        if self.app_env.lower() == "production":
            # Check database URL is not using default
            default_db_urls = {
                "",
                "mysql+pymysql://root:@localhost:3306/hotelms",
                "mysql+pymysql://root:password@localhost/db",
            }
            if self.database_url in default_db_urls:
                raise ValueError(
                    "In production, DATABASE_URL must be explicitly configured. "
                    "Using default database URL is not allowed."
                )
            
            # Check Redis URL
            if self.redis_url in ("", "redis://localhost:6379"):
                raise ValueError(
                    "In production, REDIS_URL must be explicitly configured."
                )
            
            # Check frontend URL is not localhost
            if "localhost" in self.frontend_url or "127.0.0.1" in self.frontend_url:
                raise ValueError(
                    "In production, FRONTEND_URL cannot be localhost. "
                    "Set to your actual production domain."
                )
        
        return self

    @property
    def cors_allowed_origins(self) -> list[str]:
        """Return normalized CORS origins.
        
        In production: only explicitly configured origins.
        In development: add localhost and private network for testing.
        """
        origins: list[str] = []

        # Always allow configured frontend URLs
        if self.frontend_urls.strip():
            origins.extend(
                item.strip() for item in self.frontend_urls.split(",") if item.strip()
            )
        if self.frontend_url.strip():
            origins.append(self.frontend_url.strip())

        # Only add dev defaults in development
        if self.app_env.lower() == "development":
            origins.extend([
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ])

        # Deduplicate while preserving order and normalize trailing slashes
        deduped: list[str] = []
        seen: set[str] = set()
        for origin in origins:
            normalized = origin.rstrip("/")
            if normalized and normalized not in seen:
                deduped.append(normalized)
                seen.add(normalized)

        return deduped

    @property
    def cors_allowed_origin_regex(self) -> str | None:
        """Allow private-network frontend hosts in development ONLY.
        
        Production environment: returns None (no regex matching).
        Development: returns pattern for private IP ranges.
        """
        # STRICT: No regex matching in production - only explicit origins allowed
        if self.app_env.lower() != "development":
            return None
        
        return (
            r"^(https?://)"
            r"(localhost|127\.0\.0\.1|" 
            r"192\.168\.\d{1,3}\.\d{1,3}|" 
            r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|" 
            r"172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})"
            r"(:\d+)?$"
        )


settings = Settings()

