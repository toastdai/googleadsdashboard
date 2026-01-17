/**
 * useKelkooData Hook
 * Fetches Kelkoo data from the API and provides loading/error states
 * Includes caching to prevent redundant fetches
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { dataCache, CacheKeys } from "@/lib/cache";
import { EXCHANGE_RATES } from "@/lib/constants";

export interface KelkooData {
    clickCount: number;
    clickValidCount: number;
    leadCount: number;
    trackedLeadCount: number;
    leadEstimatedRevenueInEur: number;
    leadRejectedCount: number;
    saleCount: number;
    saleValueInEur: number;
    monetizedClickPercentage: number;
    crPercentage: number;
    valuePerLeadInEur: number;
}

interface UseKelkooDataResult {
    data: KelkooData | null;
    loading: boolean;
    error: string | null;
    isFallback: boolean;
    refetch: () => void;
}



export function useKelkooData(
    startDate: string,
    endDate: string
): UseKelkooDataResult {
    const [data, setData] = useState<KelkooData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);
    const lastFetchKey = useRef<string>("");

    const fetchData = useCallback(async (forceRefresh = false) => {
        const cacheKey = CacheKeys.kelkoo(startDate, endDate);

        // Check cache first (unless forced refresh)
        if (!forceRefresh) {
            const cached = dataCache.get<{ data: KelkooData; isFallback: boolean }>(cacheKey);
            if (cached) {
                console.log('[useKelkooData] Using cached data');
                setData(cached.data);
                setIsFallback(cached.isFallback);
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/kelkoo?start_date=${startDate}&end_date=${endDate}`
            );
            const result = await response.json();

            if (result.success || result.data) {
                setData(result.data);
                setIsFallback(result.isFallback || false);
                // Cache the result
                dataCache.set(cacheKey, { data: result.data, isFallback: result.isFallback || false });
            } else {
                setError(result.error || "Failed to fetch Kelkoo data");
            }
        } catch (err) {
            setError(`Network error: ${err}`);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        const fetchKey = `${startDate}:${endDate}`;
        if (lastFetchKey.current === fetchKey && data) {
            // Same date range, already have data
            return;
        }
        lastFetchKey.current = fetchKey;
        void fetchData();
    }, [fetchData, startDate, endDate, data]);

    const refetch = () => {
        void fetchData(true); // Force refresh
    };

    return { data, loading, error, isFallback, refetch };
}

// Helper to calculate derived metrics
export function calculateKelkooMetrics(data: KelkooData) {
    return {
        totalLeads: data.leadCount,
        totalRevenueEur: data.leadEstimatedRevenueInEur,
        totalRevenueInr: data.leadEstimatedRevenueInEur * EXCHANGE_RATES.EUR_TO_INR,
        totalSales: data.saleCount,
        totalSaleValueEur: data.saleValueInEur,
        totalSaleValueInr: data.saleValueInEur * EXCHANGE_RATES.EUR_TO_INR,
        conversionRate: data.crPercentage,
        revenuePerLead: data.valuePerLeadInEur,
        clickCount: data.clickCount,
    };
}

// Calculate campaign-specific Kelkoo metrics based on click ratio
export function calculateCampaignKelkooData(
    data: KelkooData,
    campaignClicks: number,
    totalKLClicks: number,
    campaignCost: number
) {
    if (totalKLClicks === 0) {
        return {
            isKelkoo: true,
            kelkooLeads: 0,
            kelkooRevenue: 0,
            kelkooRevenueInr: 0,
            kelkooSales: 0,
            kelkooSaleValue: 0,
            kelkooSaleValueInr: 0,
            actualROAS: 0,
            profitability: 0,
        };
    }

    const clickRatio = campaignClicks / totalKLClicks;

    const kelkooLeads = Math.round(data.leadCount * clickRatio);
    const kelkooRevenue = Math.round(data.leadEstimatedRevenueInEur * clickRatio * 100) / 100;
    const kelkooSales = Math.round(data.saleCount * clickRatio);
    const kelkooSaleValue = Math.round(data.saleValueInEur * clickRatio * 100) / 100;

    const kelkooRevenueInr = Math.round(kelkooRevenue * EXCHANGE_RATES.EUR_TO_INR * 100) / 100;
    const kelkooSaleValueInr = Math.round(kelkooSaleValue * EXCHANGE_RATES.EUR_TO_INR * 100) / 100;

    // ROAS should use commission/lead revenue only (not gross sale value), otherwise we overstate returns.
    const totalRevenueInr = kelkooRevenueInr;
    const actualROAS = campaignCost > 0 ? Math.round((totalRevenueInr / campaignCost) * 100) / 100 : 0;
    const profitability = Math.round((totalRevenueInr - campaignCost) * 100) / 100;

    return {
        isKelkoo: true,
        kelkooLeads,
        kelkooRevenue,
        kelkooRevenueEur: kelkooRevenue, // EUR value for USD column conversion
        kelkooRevenueInr,
        kelkooSales,
        kelkooSaleValue,
        kelkooSaleValueInr,
        actualROAS,
        profitability,
    };
}
