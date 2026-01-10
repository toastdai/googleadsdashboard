/**
 * Kelkoo API Route
 * Fetches Kelkoo performance data for the dashboard
 */

import { NextResponse } from "next/server";

const KELKOO_API_BASE = "https://api.kelkoogroup.net/publisher/reports/v1";

interface KelkooMetrics {
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

// Parse TSV response from Kelkoo API
function parseTsvResponse(tsv: string): KelkooMetrics | null {
    const lines = tsv.trim().split("\n");
    if (lines.length < 2) return null;

    const headers = lines[0].split("\t");
    const values = lines[1].split("\t");

    const parseNumber = (val: string): number => {
        if (!val || val === "") return 0;
        const cleaned = val.replace("%", "").replace(/,/g, "");
        return parseFloat(cleaned) || 0;
    };

    const getValue = (key: string): string => {
        const idx = headers.indexOf(key);
        return idx >= 0 ? values[idx] : "";
    };

    return {
        clickCount: parseNumber(getValue("clickCount")),
        clickValidCount: parseNumber(getValue("clickValidCount")),
        leadCount: parseNumber(getValue("leadCount")),
        trackedLeadCount: parseNumber(getValue("trackedLeadCount")),
        leadEstimatedRevenueInEur: parseNumber(getValue("leadEstimatedRevenueInEur")),
        leadRejectedCount: parseNumber(getValue("leadRejectedCount")),
        saleCount: parseNumber(getValue("saleCount")),
        saleValueInEur: parseNumber(getValue("saleValueInEur")),
        monetizedClickPercentage: parseNumber(getValue("monetizedClickPercentage")),
        crPercentage: parseNumber(getValue("crPercentage")),
        valuePerLeadInEur: parseNumber(getValue("valuePerLeadInEur")),
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const today = new Date().toISOString().split("T")[0];
    const startDate = searchParams.get("start") || today;
    const endDate = searchParams.get("end") || today;

    const token = process.env.KELKOO_API_TOKEN;

    if (!token) {
        return NextResponse.json(
            {
                success: false,
                error: "Kelkoo API token not configured",
                isFallback: false,
            },
            { status: 401 }
        );
    }

    try {
        const url = `${KELKOO_API_BASE}/aggregated?start=${startDate}&end=${endDate}`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Accept": "text/tab-separated-values",
                "Accept-Encoding": "gzip",
            },
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json(
                { success: false, error: `API Error: ${response.status} - ${errorText}` },
                { status: response.status }
            );
        }

        const text = await response.text();
        const data = parseTsvResponse(text);

        if (!data) {
            return NextResponse.json(
                { success: false, error: "Failed to parse API response" },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, data, isFallback: false });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: `Fetch error: ${error}` },
            { status: 500 }
        );
    }
}
