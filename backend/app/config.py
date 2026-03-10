from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    app_name: str = "hotelms"
    app_env: str = "development"
    database_url: str = "mysql+pymysql://root:@localhost:3306/hotelms"
    redis_url: str = "redis://localhost:6379"


settings = Settings()
