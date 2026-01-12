import { useState, useEffect, useCallback, useRef } from 'react';
import { api, LiveDataResponse } from '@/lib/api';
import { dataCache, CacheKeys } from '@/lib/cache';

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
    account?: string;
}

export function useDashboardData(startDate: string, endDate: string) {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [timeSeries, setTimeSeries] = useState<MetricTimeSeries[]>([]);
    const [topCampaigns, setTopCampaigns] = useState<BreakdownItem[]>([]);
    const [accountBreakdown, setAccountBreakdown] = useState<BreakdownItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New states for live fetching
    const [isFetchingLive, setIsFetchingLive] = useState(false);
    const [liveData, setLiveData] = useState<LiveDataResponse | null>(null);
    const [dataSource, setDataSource] = useState<'database' | 'live' | 'none'>('none');

    // Track current fetch to prevent duplicate requests
    const fetchIdRef = useRef(0);
    const lastFetchKey = useRef<string>('');

    // Function to fetch live data from Google Ads API
    const fetchLiveData = useCallback(async (forceRefresh = false) => {
        if (!startDate || !endDate) return null;

        const cacheKey = CacheKeys.liveData(startDate, endDate);

        // Check cache first (unless forced refresh)
        if (!forceRefresh) {
            const cached = dataCache.get<LiveDataResponse>(cacheKey);
            if (cached) {
                console.log('[useDashboardData] Using cached live data');
                setLiveData(cached);
                setDataSource('live');

                // Populate state from cached data
                if (cached.success) {
                    populateFromLiveData(cached);
                }
                return cached;
            }
        }

        setIsFetchingLive(true);
        try {
            const data = await api.fetchLiveData({ start: startDate, end: endDate });

            // Cache the result
            dataCache.set(cacheKey, data);

            setLiveData(data);
            setDataSource('live');

            // Convert live data to dashboard format
            if (data.success) {
                populateFromLiveData(data);
            }

            return data;
        } catch (err: any) {
            console.error("Live fetch error:", err);
            setError(err.message || 'Failed to fetch live data');
            return null;
        } finally {
            setIsFetchingLive(false);
        }
    }, [startDate, endDate]);

    // Helper to populate state from live data
    const populateFromLiveData = useCallback((data: LiveDataResponse) => {
        const liveSummary: DashboardSummary = {
            impressions: { value: data.summary.impressions, change_direction: 'flat' },
            clicks: { value: data.summary.clicks, change_direction: 'flat' },
            cost: { value: parseFloat(data.summary.cost), change_direction: 'flat' },
            conversions: { value: parseFloat(data.summary.conversions), change_direction: 'flat' },
            conversion_value: { value: parseFloat(data.summary.conversion_value), change_direction: 'flat' },
            ctr: { value: parseFloat(data.summary.ctr), change_direction: 'flat' },
            cpc: { value: parseFloat(data.summary.cpc), change_direction: 'flat' },
            cpa: { value: parseFloat(data.summary.cpa), change_direction: 'flat' },
            roas: { value: parseFloat(data.summary.roas), change_direction: 'flat' },
            summary_text: `Live data: You spent ₹${parseFloat(data.summary.cost).toLocaleString()} and generated ${parseFloat(data.summary.conversions).toFixed(0)} conversions.`
        };
        setSummary(liveSummary);

        // Convert campaigns
        const liveCampaigns: BreakdownItem[] = data.campaigns.map(c => ({
            id: c.google_campaign_id,
            name: c.name,
            account: c.account_name, // Map from backend
            impressions: c.impressions,
            clicks: c.clicks,
            cost: parseFloat(c.cost),
            conversions: parseFloat(c.conversions),
            conversion_value: parseFloat(c.conversion_value),
            ctr: parseFloat(c.ctr),
            cpc: parseFloat(c.cpc),
            share_of_total: 0
        }));

        // Calculate share of total
        const totalCost = liveCampaigns.reduce((sum, c) => sum + c.cost, 0);
        liveCampaigns.forEach(c => {
            c.share_of_total = totalCost > 0 ? (c.cost / totalCost) * 100 : 0;
        });

        setTopCampaigns(liveCampaigns);

        // Calculate Account Breakdown from campaigns
        const accountsMap = new Map<string, BreakdownItem>();

        liveCampaigns.forEach(cmp => {
            const accName = cmp.account || "Unknown";
            if (!accountsMap.has(accName)) {
                accountsMap.set(accName, {
                    name: accName,
                    impressions: 0,
                    clicks: 0,
                    cost: 0,
                    conversions: 0,
                    conversion_value: 0,
                    ctr: 0,
                    cpc: 0,
                    share_of_total: 0
                });
            }

            const acc = accountsMap.get(accName)!;
            acc.impressions += cmp.impressions;
            acc.clicks += cmp.clicks;
            acc.cost += cmp.cost;
            acc.conversions += cmp.conversions;
            acc.conversion_value += cmp.conversion_value;
        });

        // Finalize account metrics
        const accountsList = Array.from(accountsMap.values()).map(acc => ({
            ...acc,
            ctr: acc.impressions > 0 ? (acc.clicks / acc.impressions) * 100 : 0,
            cpc: acc.clicks > 0 ? acc.cost / acc.clicks : 0,
            share_of_total: totalCost > 0 ? (acc.cost / totalCost) * 100 : 0
        }));

        // Sort by cost descending
        accountsList.sort((a, b) => b.cost - a.cost);

        setAccountBreakdown(accountsList);

        // Convert daily metrics to time series
        const impressionsData = data.daily_metrics.map(d => ({ date: d.date, value: d.impressions }));
        const clicksData = data.daily_metrics.map(d => ({ date: d.date, value: d.clicks }));
        const costData = data.daily_metrics.map(d => ({ date: d.date, value: parseFloat(d.cost) }));
        const conversionsData = data.daily_metrics.map(d => ({ date: d.date, value: parseFloat(d.conversions) }));

        setTimeSeries([
            { metric: 'impressions', data: impressionsData, total: data.summary.impressions, average: data.summary.impressions / Math.max(data.daily_metrics.length, 1) },
            { metric: 'clicks', data: clicksData, total: data.summary.clicks, average: data.summary.clicks / Math.max(data.daily_metrics.length, 1) },
            { metric: 'cost', data: costData, total: parseFloat(data.summary.cost), average: parseFloat(data.summary.cost) / Math.max(data.daily_metrics.length, 1) },
            { metric: 'conversions', data: conversionsData, total: parseFloat(data.summary.conversions), average: parseFloat(data.summary.conversions) / Math.max(data.daily_metrics.length, 1) }
        ]);
    }, []);

    useEffect(() => {
        const fetchKey = `${startDate}:${endDate}`;

        // Skip if same date range already being fetched
        if (lastFetchKey.current === fetchKey && (loading || isFetchingLive)) {
            console.log('[useDashboardData] Skipping duplicate fetch for', fetchKey);
            return;
        }

        // Track this fetch
        const currentFetchId = ++fetchIdRef.current;
        lastFetchKey.current = fetchKey;

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            setDataSource('none');
            setLiveData(null);

            // Abort if a newer fetch started
            if (currentFetchId !== fetchIdRef.current) return;

            try {
                // Default to deployed backend when env var missing (production safety)
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://googleads-dashboard-backend.onrender.com/api';
                const token = localStorage.getItem('token');

                const headers = {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                };

                const queryParams = `?start_date=${startDate}&end_date=${endDate}`;

                // Abort if a newer fetch started
                if (currentFetchId !== fetchIdRef.current) return;

                // 1. Fetch Summary from database
                const summaryRes = await fetch(`${apiUrl}/dashboard/summary${queryParams}`, { headers });

                // Abort if a newer fetch started
                if (currentFetchId !== fetchIdRef.current) return;

                // Handle authentication errors gracefully
                if (summaryRes.status === 401) {
                    console.warn('Dashboard API: Not authenticated - will try live fetch');
                    setSummary(null);
                    // Try live fetch
                    await fetchLiveData();
                    return;
                }

                if (!summaryRes.ok) {
                    console.warn(`Dashboard API returned ${summaryRes.status} - will try live fetch`);
                    setSummary(null);
                    await fetchLiveData();
                    return;
                }

                const summaryData = await summaryRes.json();

                console.log('[useDashboardData] Database response:', {
                    cost: summaryData.cost?.value,
                    clicks: summaryData.clicks?.value,
                    impressions: summaryData.impressions?.value,
                    dateRange: { startDate, endDate }
                });

                // Check if database has data (cost > 0 indicates data exists)
                const costValue = parseFloat(summaryData.cost?.value || '0');
                const clicksValue = parseInt(summaryData.clicks?.value || '0', 10);
                const impressionsValue = parseInt(summaryData.impressions?.value || '0', 10);
                const hasData = costValue > 0 || clicksValue > 0 || impressionsValue > 0;

                console.log('[useDashboardData] Data check:', { costValue, clicksValue, impressionsValue, hasData });

                console.log('Database check:', { costValue, clicksValue, impressionsValue, hasData });

                if (!hasData) {
                    console.log('No data in database for this range, fetching live from Google Ads API...');
                    // DON'T set summary to zeros - let fetchLiveData set the real data
                    // setSummary(summaryData);  // REMOVED - was overwriting live data

                    // Automatically fetch live data - this will set the summary
                    const liveResult = await fetchLiveData();
                    console.log('Live fetch completed:', liveResult?.success, 'Campaigns:', liveResult?.campaigns?.length);
                    return;
                }

                // Database has data, use it
                setDataSource('database');
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
                // Try live fetch as fallback
                await fetchLiveData();
            } finally {
                setLoading(false);
            }
        };

        if (startDate && endDate) {
            fetchData();
        }
    }, [startDate, endDate, fetchLiveData]);

    return {
        summary,
        timeSeries,
        topCampaigns,
        accountBreakdown,
        loading,
        error,
        // New properties for live fetching
        isFetchingLive,
        liveData,
        dataSource,
        refetchLive: fetchLiveData
    };
}
