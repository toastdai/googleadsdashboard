/**
 * useKelkooData Hook
 * Fetches Kelkoo data from the API and provides loading/error states
 */

import { useState, useEffect, useCallback } from "react";

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

const EUR_TO_INR = 89.5;

export function useKelkooData(
    startDate: string = "2025-10-01",
    endDate: string = "2025-10-31"
): UseKelkooDataResult {
    const [data, setData] = useState<KelkooData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/kelkoo?start=${startDate}&end=${endDate}`
            );
            const result = await response.json();

            if (result.success || result.data) {
                setData(result.data);
                setIsFallback(result.isFallback || false);
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
        void fetchData();
    }, [fetchData]);

    const refetch = () => {
        void fetchData();
    };

    return { data, loading, error, isFallback, refetch };
}

// Helper to calculate derived metrics
export function calculateKelkooMetrics(data: KelkooData) {
    return {
        totalLeads: data.leadCount,
        totalRevenueEur: data.leadEstimatedRevenueInEur,
        totalRevenueInr: data.leadEstimatedRevenueInEur * EUR_TO_INR,
        totalSales: data.saleCount,
        totalSaleValueEur: data.saleValueInEur,
        totalSaleValueInr: data.saleValueInEur * EUR_TO_INR,
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

    const kelkooRevenueInr = Math.round(kelkooRevenue * EUR_TO_INR * 100) / 100;
    const kelkooSaleValueInr = Math.round(kelkooSaleValue * EUR_TO_INR * 100) / 100;

    // ROAS should use commission/lead revenue only (not gross sale value), otherwise we overstate returns.
    const totalRevenueInr = kelkooRevenueInr;
    const actualROAS = campaignCost > 0 ? Math.round((totalRevenueInr / campaignCost) * 100) / 100 : 0;
    const profitability = Math.round((totalRevenueInr - campaignCost) * 100) / 100;

    return {
        isKelkoo: true,
        kelkooLeads,
        kelkooRevenue,
        kelkooRevenueInr,
        kelkooSales,
        kelkooSaleValue,
        kelkooSaleValueInr,
        actualROAS,
        profitability,
    };
}
