"use client";

import { useState, useEffect, useCallback } from "react";
import { api, DashboardSummary, BreakdownItem, MetricTimeSeries, Alert, CampaignSummary, Account } from "./api";

// Hook for fetching dashboard summary
export function useDashboardSummary(dateRange?: { start: string; end: string }) {
    const [data, setData] = useState<DashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const summary = await api.getDashboardSummary(dateRange);
            setData(summary);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch dashboard data");
            // Return mock data on error for demo purposes
            setData(getMockDashboardSummary());
        } finally {
            setIsLoading(false);
        }
    }, [dateRange?.start, dateRange?.end]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

// Hook for fetching metrics time series
export function useMetricsTimeSeries(
    metrics: string[],
    dateRange?: { start: string; end: string }
) {
    const [data, setData] = useState<MetricTimeSeries[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        if (metrics.length === 0) return;
        setIsLoading(true);
        setError(null);
        try {
            const timeSeries = await api.getMetricsTimeSeries(metrics, dateRange);
            setData(timeSeries);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch metrics");
            // Return mock data on error
            setData(getMockTimeSeries(metrics, dateRange));
        } finally {
            setIsLoading(false);
        }
    }, [metrics.join(","), dateRange?.start, dateRange?.end]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

// Hook for fetching campaign breakdown
export function useCampaignBreakdown(dateRange?: { start: string; end: string }) {
    const [data, setData] = useState<BreakdownItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getBreakdown("campaign", dateRange);
            setData(response.items);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch campaigns");
            setData(getMockCampaigns());
        } finally {
            setIsLoading(false);
        }
    }, [dateRange?.start, dateRange?.end]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refetch: fetchData };
}

// Hook for fetching alerts
export function useAlerts(filters?: { severity?: string; is_read?: boolean }) {
    const [data, setData] = useState<Alert[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getAlerts(filters);
            setData(response.alerts);
            setUnreadCount(response.unread_count);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch alerts");
            const mockAlerts = getMockAlerts();
            setData(mockAlerts);
            setUnreadCount(mockAlerts.filter(a => !a.is_read).length);
        } finally {
            setIsLoading(false);
        }
    }, [filters?.severity, filters?.is_read]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const markAsRead = async (alertId: string) => {
        try {
            await api.markAlertRead(alertId);
            setData(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch {
            // Optimistic update even on error for demo
            setData(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
            setUnreadCount(prev => Math.max(0, prev - 1));
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.markAllAlertsRead();
            setData(prev => prev.map(a => ({ ...a, is_read: true })));
            setUnreadCount(0);
        } catch {
            setData(prev => prev.map(a => ({ ...a, is_read: true })));
            setUnreadCount(0);
        }
    };

    return { data, unreadCount, isLoading, error, refetch: fetchData, markAsRead, markAllAsRead };
}

// Hook for fetching accounts
export function useAccounts() {
    const [data, setData] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getAccounts();
            setData(response.accounts);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch accounts");
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const triggerSync = async (accountId: string, fullSync = false) => {
        try {
            await api.triggerSync(accountId, fullSync);
            return true;
        } catch {
            return false;
        }
    };

    return { data, isLoading, error, refetch: fetchData, triggerSync };
}

// Mock data generators for fallback
function getMockDashboardSummary(): DashboardSummary {
    return {
        impressions: { value: 1245782, previous_value: 1089234, change_percent: 14.4, change_direction: "up" },
        clicks: { value: 45234, previous_value: 41234, change_percent: 9.7, change_direction: "up" },
        cost: { value: 156789.45, previous_value: 142345.67, change_percent: 10.1, change_direction: "up" },
        conversions: { value: 892, previous_value: 756, change_percent: 18.0, change_direction: "up" },
        conversion_value: { value: 789456.78, previous_value: 623456.78, change_percent: 26.6, change_direction: "up" },
        ctr: { value: 3.63, previous_value: 3.78, change_percent: -4.0, change_direction: "down" },
        cpc: { value: 3.47, previous_value: 3.45, change_percent: 0.6, change_direction: "up" },
        cpa: { value: 175.77, previous_value: 188.29, change_percent: -6.6, change_direction: "down" },
        roas: { value: 5.03, previous_value: 4.38, change_percent: 14.8, change_direction: "up" },
        summary_text: "You spent Rs.1.57L, got 892 conversions, with ROAS of 5.03x. For every Rs.1 spent, you earned Rs.5.03 back.",
    };
}

function getMockTimeSeries(metrics: string[], dateRange?: { start: string; end: string }): MetricTimeSeries[] {
    const days = dateRange
        ? Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / (1000 * 60 * 60 * 24)) + 1
        : 7;

    return metrics.map(metric => {
        const data = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const baseValue = metric === "impressions" ? 150000 : metric === "clicks" ? 5000 : metric === "cost" ? 20000 : 100;
            data.push({
                date: date.toISOString().split("T")[0],
                value: Math.round(baseValue * (0.8 + Math.random() * 0.4)),
            });
        }
        return {
            metric,
            data,
            total: data.reduce((sum, d) => sum + d.value, 0),
            average: data.reduce((sum, d) => sum + d.value, 0) / data.length,
        };
    });
}

function getMockCampaigns(): BreakdownItem[] {
    return [
        { id: "1", name: "Brand - Search", impressions: 523456, clicks: 18234, cost: 52345.67, conversions: 312, conversion_value: 312456.78, ctr: 3.48, cpc: 2.87, cpa: 167.77, roas: 5.97, share_of_total: 33.4 },
        { id: "2", name: "Non-Brand - Performance Max", impressions: 345678, clicks: 12456, cost: 45678.90, conversions: 245, conversion_value: 234567.89, ctr: 3.60, cpc: 3.67, cpa: 186.44, roas: 5.13, share_of_total: 29.1 },
        { id: "3", name: "Shopping - Products", impressions: 234567, clicks: 9876, cost: 34567.89, conversions: 198, conversion_value: 156789.12, ctr: 4.21, cpc: 3.50, cpa: 174.59, roas: 4.54, share_of_total: 22.0 },
        { id: "4", name: "Display - Remarketing", impressions: 142081, clicks: 4668, cost: 23456.78, conversions: 137, conversion_value: 85643.99, ctr: 3.29, cpc: 5.02, cpa: 171.22, roas: 3.65, share_of_total: 15.5 },
    ];
}

function getMockAlerts(): Alert[] {
    return [
        {
            id: "1",
            account_id: "acc-1",
            campaign_id: "camp-1",
            campaign_name: "Brand - Search",
            metric: "cost",
            alert_type: "NEGATIVE_SPIKE",
            severity: "CRITICAL",
            message: "Campaign 'Brand - Search': COST increased by 67.2% (Rs.2,345 -> Rs.3,921)",
            context: { current_value: 3921, previous_value: 2345, percent_change: 67.2, z_score: 3.8 },
            is_read: false,
            detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "2",
            account_id: "acc-1",
            campaign_id: "camp-2",
            campaign_name: "Non-Brand - Performance Max",
            metric: "conversions",
            alert_type: "POSITIVE_SPIKE",
            severity: "INFO",
            message: "Campaign 'Non-Brand - Performance Max': CONVERSIONS increased by 45.3% (45 -> 65)",
            context: { current_value: 65, previous_value: 45, percent_change: 45.3, z_score: 2.6 },
            is_read: false,
            detected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        },
        {
            id: "3",
            account_id: "acc-1",
            campaign_id: "camp-3",
            campaign_name: "Shopping - Products",
            metric: "impressions",
            alert_type: "VOLUME_ANOMALY",
            severity: "WARNING",
            message: "Campaign 'Shopping - Products': Impression volume dropped 52.4%",
            context: { current_value: 45234, previous_value: 95123, percent_change: -52.4, z_score: -3.2 },
            is_read: true,
            detected_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
    ];
}
