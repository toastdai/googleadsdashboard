/**
 * Admedia API Route
 * Fetches Admedia performance data for AM campaigns using the official Publisher API endpoints
 */

import { NextResponse } from "next/server";

const ADMEDIA_AID = process.env.ADMEDIA_AID;
const ADMEDIA_API_KEY = process.env.ADMEDIA_API_KEY;

// USD to INR conversion rate (static for now; update if finance team provides new rate)
const USD_TO_INR = 85;

interface AdmediaMetrics {
    clicks: number;
    leads: number;
    conversions: number;
    earnings: number;
    earningsInr: number;
    cpc: number;
    cpl: number;
    conversionRate: number;
}

function extractNumbers(xml: string, tag: string): number[] {
    const regex = new RegExp(`<${tag}>\\s*([^<]*)\\s*</${tag}>`, "gi");
    const values: number[] = [];

    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
        const value = Number.parseFloat(match[1]);
        if (!Number.isNaN(value)) values.push(value);
    }

    return values;
}

async function fetchXml(url: string) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Accept: "application/xml",
            "User-Agent": "GoogleAds-Dashboard/AdmediaFetcher",
        },
        cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
        throw new Error(`Admedia API error ${response.status}: ${body.slice(0, 200)}`);
    }

    if (body.toLowerCase().includes("invalid")) {
        throw new Error(`Admedia API validation failed: ${body.slice(0, 200)}`);
    }

    return body;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Get start/end dates from query params, default to yesterday for safer data availability
    let startDate = searchParams.get("start_date") || searchParams.get("start") || yesterday;
    let endDate = searchParams.get("end_date") || searchParams.get("end") || yesterday;

    // If user requests today's date, use it but be prepared for potential delays in API data
    // (Admedia typically has same-day data but with some delay)

    if (!ADMEDIA_AID || !ADMEDIA_API_KEY) {
        return NextResponse.json(
            {
                success: false,
                error: "Missing Admedia API credentials. Set ADMEDIA_AID and ADMEDIA_API_KEY in the environment.",
                isFallback: false,
            },
            { status: 500 },
        );
    }

    // Convert YYYY-MM-DD to month/year for the date-wise click report
    const start = new Date(startDate);
    const month = String(start.getUTCMonth() + 1).padStart(2, "0");
    const year = String(start.getUTCFullYear());

    try {
        // Date-wise click report (returns Revenue, Valid clicks, Total clicks)
        // The legacy reporting endpoints expect query parameters only; headers are ignored
        const dateReportUrl = `http://api.admedia.com/report.php?aid=${ADMEDIA_AID}&auth=${ADMEDIA_API_KEY}&month=${month}&year=${year}`;
        const dateReportXml = await fetchXml(dateReportUrl);

        const totalClicks = extractNumbers(dateReportXml, "Total").reduce((sum, val) => sum + val, 0);
        const validClicks = extractNumbers(dateReportXml, "Valid").reduce((sum, val) => sum + val, 0);
        const revenue = extractNumbers(dateReportXml, "Revenue").reduce((sum, val) => sum + val, 0);
        const netCpcValues = extractNumbers(dateReportXml, "NetCPC");
        const averageNetCpc = netCpcValues.length > 0
            ? netCpcValues.reduce((sum, val) => sum + val, 0) / netCpcValues.length
            : 0;

        // Merchant conversion report (returns conversions and clicks by advertiser)
        let conversions = 0;
        let conversionClicks = 0;

        // 1. Fetch first page to get total pages
        const firstConversionUrl = `http://api.admedia.com/merchant_conversion_report.php?aid=${ADMEDIA_AID}&auth=${ADMEDIA_API_KEY}&start_date=${startDate}&end_date=${endDate}&format=xml&page=1`;
        const firstConversionXml = await fetchXml(firstConversionUrl);

        conversions += extractNumbers(firstConversionXml, "conversions").reduce((sum, val) => sum + val, 0);
        conversionClicks += extractNumbers(firstConversionXml, "clicks").reduce((sum, val) => sum + val, 0);

        const totalPages = Math.min(Number.parseInt(extractNumbers(firstConversionXml, "total_pages")[0]?.toString() || "1", 10), 10);

        // 2. Fetch remaining pages in parallel
        if (totalPages > 1) {
            const pagePromises = [];
            for (let p = 2; p <= totalPages; p++) {
                const url = `http://api.admedia.com/merchant_conversion_report.php?aid=${ADMEDIA_AID}&auth=${ADMEDIA_API_KEY}&start_date=${startDate}&end_date=${endDate}&format=xml&page=${p}`;
                pagePromises.push(fetchXml(url));
            }

            const pageResults = await Promise.all(pagePromises);
            for (const xml of pageResults) {
                conversions += extractNumbers(xml, "conversions").reduce((sum, val) => sum + val, 0);
                conversionClicks += extractNumbers(xml, "clicks").reduce((sum, val) => sum + val, 0);
            }
        }

        const clicks = totalClicks || conversionClicks;
        const leads = validClicks || clicks;
        const earnings = revenue;
        const earningsInr = earnings * USD_TO_INR;
        const cpc = clicks > 0 ? earnings / clicks : averageNetCpc;
        const cpl = leads > 0 ? earnings / leads : 0;
        const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

        const data: AdmediaMetrics = {
            clicks,
            leads,
            conversions,
            earnings: Math.round(earnings * 100) / 100,
            earningsInr: Math.round(earningsInr * 100) / 100,
            cpc: Math.round(cpc * 100) / 100,
            cpl: Math.round(cpl * 100) / 100,
            conversionRate: Math.round(conversionRate * 100) / 100,
        };

        return NextResponse.json({
            success: true,
            data,
            campaigns: [],
            isFallback: false,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Admedia API error";
        console.error("Admedia API call failed:", message);

        return NextResponse.json(
            {
                success: false,
                error: message,
                isFallback: false,
            },
            { status: 502 },
        );
    }
}
