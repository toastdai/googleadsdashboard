"""
TellSpike Backend Configuration

Loads environment variables and provides typed configuration.
"""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "TellSpike"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"
    
    # Database
    database_url: str = "postgresql://postgres:password@localhost:5432/tellspike"
    
    # Redis
    redis_url: str = "redis://localhost:6379/0"
    
    # Google Ads API
    google_ads_developer_token: str = ""
    google_ads_client_id: str = ""
    google_ads_client_secret: str = ""
    google_ads_login_customer_id: Optional[str] = None
    
    # OAuth2
    oauth_redirect_uri: str = "http://localhost:8000/api/auth/callback"
    
    # JWT
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    
    # Email (optional)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    email_from: str = "noreply@tellspike.com"
    
    # Slack (optional)
    slack_webhook_url: Optional[str] = None
    
    # Frontend URL (for CORS)
    frontend_url: str = "http://localhost:3000"
    
    # Rate Limiting
    api_rate_limit_per_minute: int = 60
    google_ads_requests_per_second: float = 0.5  # Conservative rate limiting
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
