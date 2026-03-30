"""
Configuration Management
Pydantic Settings for environment-based configuration
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application Settings loaded from .env"""

    # Application
    app_env: str = "local"
    app_debug: bool = True
    app_name: str = "Hotel Management SaaS"
    app_version: str = "3.0.0"

    # Database
    db_driver: str = "mysql"
    db_host: str = "localhost"
    db_port: int = 3306
    db_user: str = "root"
    db_pass: str = ""
    db_name: str = "hotel_saas_db"
    db_echo: bool = False

    # JWT
    jwt_secret: str = "change_me_in_production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 30

    # Server
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    workers: int = 1

    # Security
    cors_origins: List[str] = ["http://localhost:3000"]
    allowed_hosts: List[str] = ["localhost"]
    secure_cookies: bool = False
    csrf_enabled: bool = True

    # File Upload
    upload_max_size: int = 5 * 1024 * 1024  # 5MB
    upload_dir: str = "storage/uploads"
    allowed_upload_types: List[str] = ["jpg", "jpeg", "png", "gif", "webp"]

    # Logging
    log_level: str = "DEBUG"
    log_path: str = "storage/logs"
    max_log_days: int = 30

    # Cache
    cache_backend: str = "memory"

    # Email (optional)
    mail_server: Optional[str] = None
    mail_port: Optional[int] = None
    mail_username: Optional[str] = None
    mail_password: Optional[str] = None

    # Defaults
    default_currency: str = "USD"
    default_timezone: str = "UTC"

    class Config:
        env_file = ".env"
        case_sensitive = False

    @property
    def database_url(self) -> str:
        """Build database URL for SQLAlchemy"""
        return f"{self.db_driver}+pymysql://{self.db_user}:{self.db_pass}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.app_env == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development"""
        return self.app_env in ["local", "development"]


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance
    Cached to avoid reading .env file multiple times
    """
    return Settings()


# Export for use in app
settings = get_settings()
