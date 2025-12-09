/**
 * MaxBounty API Route
 * Fetches MaxBounty affiliate performance data for the dashboard
 * API Documentation: https://mb1-cdn.com/resources/docs_affiliate_api_v1.html
 */

import { NextResponse } from "next/server";

const MAXBOUNTY_API_BASE = "https://api.maxbounty.com/affiliates/api";
const MAXBOUNTY_EMAIL = process.env.MAXBOUNTY_EMAIL;
const MAXBOUNTY_PASSWORD = process.env.MAXBOUNTY_PASSWORD;

// USD to INR conversion rate
const USD_TO_INR = 83.5;

interface MaxBountyAuthResponse {
    success: boolean;
    "mb-api-token"?: string;
    "mb-app-token"?: string;
    "mb-aid"?: number;
    errors?: { message: string };
}

interface MaxBountyCampaign {
    name: string;
    campaign_id: number;
    clicks: number;
    leads: number;
    earnings: number;
    conversion: number;
    epc: number;
    sales: number;
}

interface MaxBountyReportResponse {
    success: boolean;
    report?: MaxBountyCampaign[];
    totals?: {
        clicks: number;
        leads: number;
        conversion: number;
        epc: number;
        sales: number;
        earnings: number;
    };
    errors?: { message: string };
}

interface MaxBountyMetrics {
    clicks: number;
    leads: number;
    earnings: number;
    earningsInr: number;
    conversion: number;
    epc: number;
    sales: number;
    campaigns: MaxBountyCampaign[];
}

// Token cache to avoid re-authenticating on every request
let cachedToken: string | null = null;
let tokenExpiry: number = 0;

function parseDates(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("start") || "2025-10-01";
    const endDate = searchParams.get("end") || "2025-10-31";
    return { startDate, endDate };
}

function ensureCredentialsConfigured() {
    if (!MAXBOUNTY_EMAIL || !MAXBOUNTY_PASSWORD) {
        return NextResponse.json(
            {
                success: false,
                error: "MaxBounty credentials not configured. Set MAXBOUNTY_EMAIL and MAXBOUNTY_PASSWORD in environment.",
                isFallback: false,
            },
            { status: 401 }
        );
    }
    return null;
}

function buildErrorResponse(error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown MaxBounty API error";
    console.error("MaxBounty API call failed:", message);

    return NextResponse.json(
        {
            success: false,
            error: message,
            isFallback: false,
        },
        { status: 500 }
    );
}

async function authenticate(): Promise<string> {
    // Check if we have a valid cached token (with 5 minute buffer)
    if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
        return cachedToken;
    }

    if (!MAXBOUNTY_EMAIL || !MAXBOUNTY_PASSWORD) {
        throw new Error("MaxBounty credentials not configured");
    }

    const response = await fetch(`${MAXBOUNTY_API_BASE}/authentication`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email: MAXBOUNTY_EMAIL,
            password: MAXBOUNTY_PASSWORD,
        }),
    });

    const data: MaxBountyAuthResponse = await response.json();

    if (!data.success || !data["mb-api-token"]) {
        throw new Error(data.errors?.message || "Authentication failed");
    }

    // Cache the token (expires in 2 hours, we'll refresh after 1h55m)
    cachedToken = data["mb-api-token"];
    tokenExpiry = Date.now() + 2 * 60 * 60 * 1000; // 2 hours from now

    return cachedToken;
}

async function fetchEarningsReport(
    token: string,
    startDate: string,
    endDate: string
): Promise<MaxBountyReportResponse> {
    const url = `${MAXBOUNTY_API_BASE}/reports/earnings?startDate=${startDate}&endDate=${endDate}`;
    
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "x-access-token": token,
            "Content-Type": "application/json",
        },
    });

    return response.json();
}

// Fetch report with one retry on token failure
async function fetchReportWithRetry(startDate: string, endDate: string) {
    // Authenticate and get token
    const token = await authenticate();

    // Fetch earnings report
    const reportData = await fetchEarningsReport(token, startDate, endDate);

    if (reportData.success) return reportData;

    // If token expired, clear cache and retry once
    if (reportData.errors?.message?.includes("token")) {
        cachedToken = null;
        tokenExpiry = 0;
        const newToken = await authenticate();
        const retryData = await fetchEarningsReport(newToken, startDate, endDate);
        if (retryData.success) return retryData;
    }

    throw new Error(reportData.errors?.message || "Failed to fetch earnings report");
}

export async function GET(request: Request) {
    const { startDate, endDate } = parseDates(request);

    const credentialError = ensureCredentialsConfigured();
    if (credentialError) return credentialError;

    try {
        const reportData = await fetchReportWithRetry(startDate, endDate);
        return processReport(reportData);
    } catch (error) {
        return buildErrorResponse(error);
    }
}

function processReport(reportData: MaxBountyReportResponse) {
    const totals = reportData.totals || {
        clicks: 0,
        leads: 0,
        conversion: 0,
        epc: 0,
        sales: 0,
        earnings: 0,
    };

    const campaigns = reportData.report || [];

    const data: MaxBountyMetrics = {
        clicks: totals.clicks,
        leads: totals.leads,
        earnings: Math.round(totals.earnings * 100) / 100,
        earningsInr: Math.round(totals.earnings * USD_TO_INR * 100) / 100,
        conversion: Math.round(totals.conversion * 100) / 100,
        epc: Math.round(totals.epc * 100) / 100,
        sales: Math.round(totals.sales * 100) / 100,
        campaigns: campaigns.map((c) => ({
            name: c.name,
            campaign_id: c.campaign_id,
            clicks: c.clicks,
            leads: c.leads,
            earnings: Math.round(c.earnings * 100) / 100,
            conversion: Math.round(c.conversion * 100) / 100,
            epc: Math.round(c.epc * 100) / 100,
            sales: Math.round(c.sales * 100) / 100,
        })),
    };

    return NextResponse.json({
        success: true,
        data,
        isFallback: false,
    });
}
