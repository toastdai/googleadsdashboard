/**
 * API Client for TellSpike Backend
 */

// Default to deployed backend when env var missing (production safety)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://googleads-dashboard-backend.onrender.com/api";

interface ApiError {
    detail: string;
}

interface RequestOptions extends RequestInit {
    params?: Record<string, string>;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private getToken(): string | null {
        if (typeof window !== "undefined") {
            return localStorage.getItem("token");
        }
        return null;
    }

    private async request<T>(
        endpoint: string,
        options: RequestOptions = {}
    ): Promise<T> {
        const { params, ...fetchOptions } = options;

        let url = `${this.baseUrl}${endpoint}`;

        // Add query params
        if (params) {
            const searchParams = new URLSearchParams(params);
            url += `?${searchParams.toString()}`;
        }

        // Default headers
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers as Record<string, string>),
        };

        // Add auth token
        const token = this.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...fetchOptions,
            headers,
        });

        if (!response.ok) {
            const error: ApiError = await response.json().catch(() => ({
                detail: "An unexpected error occurred",
            }));
            throw new Error(error.detail);
        }

        // Handle 204 No Content
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    // Auth endpoints
    async getGoogleAuthUrl() {
        return this.request<{ authorization_url: string }>("/auth/google");
    }

    async login(email: string, password: string) {
        return this.request<{
            access_token: string;
            token_type: string;
            expires_in: number;
        }>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
    }

    async register(email: string, name: string, password: string) {
        return this.request<{ id: string; email: string; name: string }>(
            "/auth/register",
            {
                method: "POST",
                body: JSON.stringify({ email, name, password }),
            }
        );
    }

    async getCurrentUser() {
        return this.request<{
            id: string;
            email: string;
            name: string;
            is_active: boolean;
            is_verified: boolean;
            settings: Record<string, unknown>;
        }>("/auth/me");
    }

    // Dashboard endpoints
    async getDashboardSummary(dateRange?: { start: string; end: string }) {
        const params: Record<string, string> = {};
        if (dateRange) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }
        return this.request<DashboardSummary>("/dashboard/summary", { params });
    }

    async getMetricsTimeSeries(
        metrics: string[],
        dateRange?: { start: string; end: string }
    ) {
        const params: Record<string, string> = {
            metrics: metrics.join(","),
        };
        if (dateRange) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }
        return this.request<MetricTimeSeries[]>("/dashboard/metrics", { params });
    }

    async getBreakdown(
        dimension: "campaign" | "device" | "network",
        dateRange?: { start: string; end: string }
    ) {
        const params: Record<string, string> = {};
        if (dateRange) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }
        return this.request<BreakdownResponse>(`/dashboard/breakdown/${dimension}`, {
            params,
        });
    }

    async getROISummary(dateRange?: { start: string; end: string }) {
        const params: Record<string, string> = {};
        if (dateRange) {
            params.start_date = dateRange.start;
            params.end_date = dateRange.end;
        }
        return this.request<ROIView>("/dashboard/roi", { params });
    }

    // Campaigns
    async getCampaigns(filters?: { status?: string }) {
        const params: Record<string, string> = {};
        if (filters?.status) {
            params.status = filters.status;
        }
        return this.request<CampaignSummary[]>("/campaigns", { params });
    }

    // Alerts
    async getAlerts(filters?: { severity?: string; is_read?: boolean }) {
        const params: Record<string, string> = {};
        if (filters?.severity) params.severity = filters.severity;
        if (filters?.is_read !== undefined)
            params.is_read = String(filters.is_read);
        return this.request<AlertListResponse>("/alerts", { params });
    }

    async markAlertRead(alertId: string) {
        return this.request(`/alerts/${alertId}/read`, { method: "PATCH" });
    }

    async markAllAlertsRead() {
        return this.request("/alerts/read-all", { method: "POST" });
    }

    // Accounts
    async getAccounts() {
        return this.request<{ accounts: Account[]; total: number }>("/accounts");
    }

    async triggerSync(accountId: string, fullSync = false) {
        return this.request(`/accounts/${accountId}/sync?full_sync=${fullSync}`, {
            method: "POST",
        });
    }

    // Alert Management
    async getAlertConfig() {
        return this.request<AlertConfig>("/alerts/config");
    }

    async triggerSpikeCheck() {
        return this.request<SpikeCheckResult>("/alerts/check-spikes", {
            method: "POST",
        });
    }

    async pauseAlerts() {
        return this.request<{ paused: boolean; message: string }>("/alerts/pause", {
            method: "POST",
        });
    }

    async resumeAlerts() {
        return this.request<{ paused: boolean; message: string }>("/alerts/resume", {
            method: "POST",
        });
    }

    async testTelegramConnection() {
        return this.request<{ success: boolean; message_id?: number; error?: string }>("/alerts/test", {
            method: "POST",
        });
    }

    // Live data fetching - fetches directly from Google Ads API
    async fetchLiveData(dateRange: { start: string; end: string }) {
        return this.request<LiveDataResponse>("/sync/fetch-live", {
            params: {
                start_date: dateRange.start,
                end_date: dateRange.end
            }
        });
    }
}

// Types for live data response
export interface LiveDataResponse {
    success: boolean;
    source: string;
    date_range: {
        start: string;
        end: string;
    };
    summary: {
        impressions: number;
        clicks: number;
        cost: string;
        conversions: string;
        conversion_value: string;
        ctr: string;
        cpc: string;
        cpa: string;
        roas: string;
    };
    campaigns: LiveCampaign[];
    daily_metrics: LiveDailyMetric[];
    accounts_synced: number;
}

export interface LiveCampaign {
    google_campaign_id: string;
    name: string;
    impressions: number;
    clicks: number;
    cost: string;
    conversions: string;
    conversion_value: string;
    ctr: string;
    cpc: string;
}

export interface LiveDailyMetric {
    date: string;
    impressions: number;
    clicks: number;
    cost: string;
    conversions: string;
}

// Types
export interface MetricValue {
    value: number;
    previous_value?: number;
    change_percent?: number;
    change_direction?: "up" | "down" | "flat";
}

export interface DashboardSummary {
    impressions: MetricValue;
    clicks: MetricValue;
    cost: MetricValue;
    conversions: MetricValue;
    conversion_value: MetricValue;
    ctr: MetricValue;
    cpc: MetricValue;
    cpa: MetricValue;
    roas: MetricValue;
    summary_text: string;
}

export interface MetricDataPoint {
    date: string;
    value: number;
    previous_value?: number;
}

export interface MetricTimeSeries {
    metric: string;
    data: MetricDataPoint[];
    total: number;
    average: number;
}

export interface BreakdownItem {
    id?: string;
    name: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversion_value: number;
    ctr: number;
    cpc: number;
    cpa?: number;
    roas?: number;
    share_of_total: number;
}

export interface BreakdownResponse {
    dimension: string;
    items: BreakdownItem[];
    total_items: number;
}

export interface ROIView {
    total_spend: number;
    total_conversions: number;
    total_conversion_value: number;
    roas: number;
    estimated_profit: number;
    roas_text: string;
}

export interface CampaignSummary {
    id: string;
    google_campaign_id: string;
    name: string;
    status: string;
    campaign_type: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpc: number;
    roas?: number;
}

export interface Alert {
    id: string;
    account_id: string;
    campaign_id?: string;
    campaign_name?: string;
    metric: string;
    alert_type: string;
    severity: "INFO" | "WARNING" | "CRITICAL";
    message: string;
    context: Record<string, unknown>;
    is_read: boolean;
    detected_at: string;
    created_at: string;
}

export interface AlertListResponse {
    alerts: Alert[];
    total: number;
    unread_count: number;
}

export interface Account {
    id: string;
    customer_id: string;
    name: string;
    currency_code: string;
    is_manager: boolean;
    is_active: boolean;
    last_sync_at?: string;
    created_at: string;
}

export interface AlertConfig {
    telegram_configured: boolean;
    spike_threshold_percent: number;
    frontend_url: string;
    scheduler_running: boolean;
    scheduler_interval_minutes?: number;
    next_check?: string;
    alerts_paused?: boolean;
}

export interface SpikeCheckResult {
    success: boolean;
    spikes_detected: number;
    alerts_sent: number;
    networks_checked: string[];
    timestamp: string;
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

