/**
 * useAdmediaData Hook
 * Fetches Admedia data from the API and provides loading/error states
 */

"use client";

import { useState, useEffect, useCallback } from "react";

export interface AdmediaData {
    clicks: number;
    leads: number;
    conversions: number;
    earnings: number;
    earningsInr: number;
    cpc: number;
    cpl: number;
    conversionRate: number;
}

export interface AdmediaCampaignData {
    campaignName: string;
    clicks: number;
    leads: number;
    conversions: number;
    earnings: number;
    earningsInr: number;
}

interface UseAdmediaDataResult {
    data: AdmediaData | null;
    campaigns: AdmediaCampaignData[];
    loading: boolean;
    error: string | null;
    isFallback: boolean;
    refetch: () => void;
}

const USD_TO_INR = 83.5;

export function useAdmediaData(
    startDate: string = "2025-10-01",
    endDate: string = "2025-10-31"
): UseAdmediaDataResult {
    const [data, setData] = useState<AdmediaData | null>(null);
    const [campaigns, setCampaigns] = useState<AdmediaCampaignData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);

    const applyResult = useCallback((result: any) => {
        if (!(result?.success && result.data)) {
            throw new Error(result?.error || "Failed to fetch Admedia data");
        }

        setData(result.data);
        setCampaigns(result.campaigns || []);
        setIsFallback(Boolean(result.isFallback));
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/admedia?start=${startDate}&end=${endDate}`
            );

            if (!response.ok) {
                const message = await response.text();
                throw new Error(message || `Request failed with ${response.status}`);
            }

            const result = await response.json();
            applyResult(result);
        } catch (err) {
            setData(null);
            setCampaigns([]);
            setIsFallback(false);
            setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refetch = () => {
        void fetchData();
    };

    return { data, campaigns, loading, error, isFallback, refetch };
}

// Helper to calculate derived metrics
export function calculateAdmediaMetrics(data: AdmediaData) {
    return {
        totalLeads: data.leads,
        totalConversions: data.conversions,
        totalEarnings: data.earnings,
        totalEarningsInr: data.earningsInr,
        conversionRate: data.leads > 0 ? (data.conversions / data.leads) * 100 : 0,
        cpc: data.cpc,
        cpl: data.cpl,
    };
}

// Calculate campaign-specific Admedia metrics based on click ratio
export function calculateCampaignAdmediaData(
    data: AdmediaData,
    campaignClicks: number,
    totalAMClicks: number,
    campaignCost: number
) {
    if (totalAMClicks === 0) {
        return {
            isAdmedia: true,
            admediaLeads: 0,
            admediaConversions: 0,
            admediaEarnings: 0,
            admediaEarningsInr: 0,
            actualROAS: 0,
            profitability: 0,
        };
    }

    const clickRatio = campaignClicks / totalAMClicks;

    const admediaLeads = Math.round(data.leads * clickRatio);
    const admediaConversions = Math.round(data.conversions * clickRatio);
    const admediaEarnings = Math.round(data.earnings * clickRatio * 100) / 100;
    const admediaEarningsInr = Math.round(admediaEarnings * USD_TO_INR * 100) / 100;

    const actualROAS = campaignCost > 0 ? Math.round((admediaEarningsInr / campaignCost) * 100) / 100 : 0;
    const profitability = Math.round((admediaEarningsInr - campaignCost) * 100) / 100;

    return {
        isAdmedia: true,
        admediaLeads,
        admediaConversions,
        admediaEarnings,
        admediaEarningsInr,
        actualROAS,
        profitability,
    };
}
