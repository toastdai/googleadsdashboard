"""TellSpike Schemas Package - Pydantic Models for API"""

from app.schemas.user import (
    UserCreate, UserUpdate, UserResponse, UserLogin,
    Token, TokenPayload
)
from app.schemas.account import (
    GoogleAdsAccountCreate, GoogleAdsAccountResponse, AccountListResponse
)
from app.schemas.dashboard import (
    KPISummary, MetricTimeSeries, BreakdownItem, BreakdownResponse,
    DashboardFilters
)
from app.schemas.alerts import (
    AlertResponse, AlertListResponse, AlertSettingCreate, AlertSettingResponse,
    NotificationChannelCreate, NotificationChannelResponse
)
from app.schemas.reports import (
    SavedReportCreate, SavedReportResponse, ReportConfig
)

__all__ = [
    "UserCreate", "UserUpdate", "UserResponse", "UserLogin",
    "Token", "TokenPayload",
    "GoogleAdsAccountCreate", "GoogleAdsAccountResponse", "AccountListResponse",
    "KPISummary", "MetricTimeSeries", "BreakdownItem", "BreakdownResponse",
    "DashboardFilters",
    "AlertResponse", "AlertListResponse", "AlertSettingCreate", "AlertSettingResponse",
    "NotificationChannelCreate", "NotificationChannelResponse",
    "SavedReportCreate", "SavedReportResponse", "ReportConfig",
]
