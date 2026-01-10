import { useState, useEffect } from 'react';

// Types mirroring backend schemas
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

export interface MetricValue {
    value: number;
    previous_value?: number;
    change_percent?: number;
    change_direction?: "up" | "down" | "flat";
}

export interface MetricTimeSeries {
    metric: string;
    data: { date: string; value: number }[];
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
    share_of_total: number;
}

export function useDashboardData(startDate: string, endDate: string) {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([]);
    const [topCampaigns, setTopCampaigns] = useState<BreakdownItem[]>([]);
    const [accountBreakdown, setAccountBreakdown] = useState<BreakdownItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // Default to deployed backend when env var missing (production safety)
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://googleads-dashboard-backend.onrender.com/api';
                const token = localStorage.getItem('token'); // Assuming auth token is stored here

                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                const queryParams = `?start_date=${startDate}&end_date=${endDate}`;

                // 1. Fetch Summary
                const summaryRes = await fetch(`${apiUrl}/dashboard/summary${queryParams}`, { headers });
                
                // Handle authentication errors gracefully
                if (summaryRes.status === 401) {
                    console.warn('Dashboard API: Not authenticated - using demo/fallback data');
                    // Set empty data so partner APIs still work
                    setSummary(null);
                    setLoading(false);
                    return;
                }
                
                if (!summaryRes.ok) {
                    console.warn(`Dashboard API returned ${summaryRes.status} - using fallback`);
                    setSummary(null);
                    setLoading(false);
                    return;
                }
                
                const summaryData = await summaryRes.json();
                setSummary(summaryData);

                // 2. Fetch Time Series (Impressions, Clicks, Cost)
                const trendsRes = await fetch(`${apiUrl}/dashboard/metrics${queryParams}&metrics=impressions&metrics=clicks&metrics=cost&metrics=conversions`, { headers });
                if (trendsRes.ok) {
                    const trendsData = await trendsRes.json();
                    setTimeSeries(trendsData);
                }

                // 3. Fetch Campaigns (Top 100 for now to populate table)
                const campaignsRes = await fetch(`${apiUrl}/dashboard/breakdown/campaign${queryParams}&limit=100`, { headers });
                if (campaignsRes.ok) {
                    const campaignsData = await campaignsRes.json();
                    setTopCampaigns(campaignsData.items || []);
                }

                // 4. Fetch Account Breakdown
                const accountsRes = await fetch(`${apiUrl}/dashboard/breakdown/customer_client${queryParams}`, { headers });
                if (accountsRes.ok) {
                    const accountsData = await accountsRes.json();
                    setAccountBreakdown(accountsData.items || []);
                }

            } catch (err: any) {
                console.error("Dashboard fetch error:", err);
                setError(err.message || 'An error occurred fetching dashboard data');
            } finally {
                setLoading(false);
            }
        };

        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate]);

    return {
        summary,
        timeSeries,
        topCampaigns,
        accountBreakdown,
        loading,
        error
    };
}
