/**
 * useMaxBountyData Hook
 * Fetches MaxBounty data from the API and provides loading/error states
 */

"use client";

import { useState, useEffect, useCallback } from "react";

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

export function useMaxBountyData(
    startDate: string = "2025-10-01",
    endDate: string = "2025-10-31"
): UseMaxBountyDataResult {
    const [data, setData] = useState<MaxBountyData | null>(null);
    const [campaigns, setCampaigns] = useState<MaxBountyCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFallback, setIsFallback] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `/api/maxbounty?start=${startDate}&end=${endDate}`
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
    return `${value.toFixed(2)}%`;
}

const USD_TO_INR = 83.5;

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
        maxBountyEarningsInr,
        actualROAS,
        profitability,
    };
}
