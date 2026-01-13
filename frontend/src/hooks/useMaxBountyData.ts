/**
 * useMaxBountyData Hook
 * Fetches MaxBounty data from the API and provides loading/error states
 * Includes caching to prevent redundant fetches
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache, CacheKeys } from "@/lib/cache";

// Safe toFixed wrapper to prevent errors on null/undefined/non-numeric values
const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return "0";
    return num.toFixed(decimals);
};

export interface MaxBountyCampaign {
    name: string;
    campaign_id: number;
    clicks: number;
    leads: number;
    earnings: number;
    conversion: number;
    epc: number;
    sales: number;
}

export interface MaxBountyData {
    clicks: number;
    leads: number;
    earnings: number;
    earningsInr: number;
    conversion: number;
    epc: number;
    sales: number;
    campaigns: MaxBountyCampaign[];
}

interface UseMaxBountyDataResult {
    data: MaxBountyData | null;
    campaigns: MaxBountyCampaign[];
    loading: boolean;
    error: string | null;
    isFallback: boolean;
    refetch: () => void;
}

interface CachedMaxBountyResult {
    data: MaxBountyData;
    isFallback: boolean;
}

export function useMaxBountyData(
    startDate: string,
    endDate: string
): UseMaxBountyDataResult {
    const [data, setData] = useState<MaxBountyData | null>(null);
    const [campaigns, setCampaigns] = useState<MaxBountyCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);
    const lastFetchKey = useRef<string>("");

    const fetchData = useCallback(async (forceRefresh = false) => {
        const cacheKey = CacheKeys.maxbounty(startDate, endDate);

        // Check cache first (unless forced refresh)
        if (!forceRefresh) {
            const cached = dataCache.get<CachedMaxBountyResult>(cacheKey);
            if (cached) {
                console.log('[useMaxBountyData] Using cached data');
                setData(cached.data);
                setCampaigns(cached.data?.campaigns || []);
                setIsFallback(cached.isFallback);
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/maxbounty?start_date=${startDate}&end_date=${endDate}`
            );

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || `Request failed with ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Failed to fetch MaxBounty data");
            }

            setData(result.data);
            setCampaigns(result.data?.campaigns || []);
            setIsFallback(Boolean(result.isFallback));

            // Cache the result
            dataCache.set(cacheKey, {
                data: result.data,
                isFallback: Boolean(result.isFallback)
            });
        } catch (err) {
            // Set default empty data instead of null to prevent rendering errors
            setData({
                clicks: 0,
                leads: 0,
                earnings: 0,
                earningsInr: 0,
                conversion: 0,
                epc: 0,
                sales: 0,
                campaigns: []
            });
            setCampaigns([]);
            setIsFallback(false);
            const errorMessage = err instanceof Error ? err.message : String(err);
            // Only show error if it's not a simple "no data" scenario
            if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
                setError('Authentication required');
            } else if (!errorMessage.includes('No data') && !errorMessage.includes('empty')) {
                setError(errorMessage.length > 50 ? errorMessage.substring(0, 50) + '...' : errorMessage);
            }
            console.error('MaxBounty fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        const fetchKey = `${startDate}:${endDate}`;
        if (lastFetchKey.current === fetchKey && data) {
            return;
        }
        lastFetchKey.current = fetchKey;
        fetchData();
    }, [fetchData, startDate, endDate, data]);

    const refetch = () => {
        void fetchData(true); // Force refresh
    };

    return { data, campaigns, loading, error, isFallback, refetch };
}

// Helper to format currency
export function formatMaxBountyCurrency(amount: number, currency: "USD" | "INR" = "USD"): string {
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return formatter.format(amount);
}

// Helper to format percentage
export function formatMaxBountyPercentage(value: number): string {
    return `${safeToFixed(value, 2)}%`;
}

const USD_TO_INR = 85;

// Calculate campaign-specific MaxBounty metrics based on click ratio
export function calculateCampaignMaxBountyData(
    data: MaxBountyData,
    campaignClicks: number,
    totalMBClicks: number,
    campaignCost: number
) {
    if (totalMBClicks === 0) {
        return {
            isMaxBounty: true,
            maxBountyLeads: 0,
            maxBountySales: 0,
            maxBountyEarnings: 0,
            maxBountyEarningsInr: 0,
            actualROAS: 0,
            profitability: 0,
        };
    }

    const clickRatio = campaignClicks / totalMBClicks;

    const maxBountyLeads = Math.round(data.leads * clickRatio);
    const maxBountySales = Math.round(data.sales * clickRatio);
    const maxBountyEarnings = Math.round(data.earnings * clickRatio * 100) / 100;
    const maxBountyEarningsInr = Math.round(maxBountyEarnings * USD_TO_INR * 100) / 100;

    const actualROAS = campaignCost > 0 ? Math.round((maxBountyEarningsInr / campaignCost) * 100) / 100 : 0;
    const profitability = Math.round((maxBountyEarningsInr - campaignCost) * 100) / 100;

    return {
        isMaxBounty: true,
        maxBountyLeads,
        maxBountySales,
        maxBountyEarnings,
        maxBountyEarningsUsd: maxBountyEarnings, // USD value for column display
        maxBountyEarningsInr,
        actualROAS,
        profitability,
    };
}
