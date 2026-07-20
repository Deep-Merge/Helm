from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    gemini_api_key: str = ""
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    cors_origins: str = "http://localhost:3001"
    dev_mode: bool = True
    local_persistence: bool = True
    local_data_path: str = "data/store.json"
    database_url: str = ""
    migrate_json_on_startup: bool = False
    local_auth_secret: str = "change-this-local-auth-secret"
    allow_dev_token: bool = False
    admin_email: str = ""
    admin_password: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def postgres_configured(self) -> bool:
        return bool(self.database_url)

    @property
    def local_auth_enabled(self) -> bool:
        return (self.postgres_configured or not self.supabase_configured) and bool(self.local_auth_secret)


settings = Settings()
