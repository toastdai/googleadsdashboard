/**
 * Admedia Publisher API Integration Service
 * Fetches revenue and lead data from Admedia for AM campaigns
 * 
 * API Credentials:
 * AID: 122250
 * API Key: 2fb42a467452b41e946c29860736afb6
 */

// Admedia API configuration (values must be provided via environment)
const ADMEDIA_API_BASE = "https://api.admedia.com/publisher/v1";
const ADMEDIA_AID = process.env.NEXT_PUBLIC_ADMEDIA_AID ?? "";
const ADMEDIA_API_KEY = process.env.NEXT_PUBLIC_ADMEDIA_API_KEY ?? "";

export interface AdmediaMetrics {
    clicks: number;
    leads: number;
    conversions: number;
    earnings: number; // In USD
    earningsInr: number; // In INR
    cpc: number; // Cost per click
    cpl: number; // Cost per lead
    conversionRate: number;
}

export interface AdmediaApiResponse {
    success: boolean;
    data: AdmediaMetrics | null;
    error?: string;
}

export interface AdmediaCampaignData {
    campaignName: string;
    clicks: number;
    leads: number;
    conversions: number;
    earnings: number;
}

// USD to INR conversion rate
export const USD_TO_INR = 83.5;

// EUR to INR conversion rate
export const EUR_TO_INR = 89.5;

/**
 * Static Admedia data for October 2025
 * This is pre-fetched data to avoid API calls on each page load
 * Campaigns ending with -AM use Admedia for lead/conversion tracking
 */
export const admediaOctoberData: AdmediaMetrics = {
    clicks: 2535,
    leads: 1469,
    conversions: 587,
    earnings: 4823.45, // USD
    earningsInr: 402758.08, // INR (USD * 83.5)
    cpc: 1.9,
    cpl: 3.28,
    conversionRate: 23.15,
};

// Campaign-level Admedia data for October 2025
// Based on proportional distribution by clicks
export const admediaCampaignBreakdown: AdmediaCampaignData[] = [
    {
        campaignName: "Kohl's - US - AM",
        clicks: 867,
        leads: 502,
        conversions: 201,
        earnings: 1648.78,
    },
    {
        campaignName: "Macy's-USA-AM",
        clicks: 233,
        leads: 135,
        conversions: 54,
        earnings: 443.18,
    },
    {
        campaignName: "Zenni optical-us-am",
        clicks: 1423,
        leads: 824,
        conversions: 329,
        earnings: 2708.39,
    },
    {
        campaignName: "Adameve-us-AM",
        clicks: 12,
        leads: 8,
        conversions: 3,
        earnings: 23.1,
    },
];

// Campaigns that use Admedia (ending with -AM)
export const admediaCampaignIds = [
    "camp-2",  // Kohl's - US - AM
    "camp-3",  // Macy's-USA-AM
    "camp-16", // Zenni optical-us-am
    "camp-17", // Adameve-us-AM
];

// Parse JSON response from Admedia API
function parseAdmediaResponse(json: Record<string, unknown>): AdmediaMetrics | null {
    try {
        const data = json?.data as Record<string, unknown> | undefined;
        if (!data) return null;

        const toNumber = (value: unknown): number => {
            if (value == null) return 0;
            if (typeof value === "number") return Number.isFinite(value) ? value : 0;
            if (typeof value === "string") {
                const parsed = Number.parseFloat(value);
                return Number.isFinite(parsed) ? parsed : 0;
            }
            return 0;
        };

        return {
            clicks: toNumber(data.clicks),
            leads: toNumber(data.leads),
            conversions: toNumber(data.conversions),
            earnings: toNumber(data.earnings),
            earningsInr: toNumber(data.earnings) * USD_TO_INR,
            cpc: toNumber(data.cpc),
            cpl: toNumber(data.cpl),
            conversionRate: toNumber(data.conversion_rate),
        };
    } catch (error) {
        console.error("Error parsing Admedia response:", error);
        return null;
    }
}

/**
 * Fetch aggregated Admedia data for a date range
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
export async function fetchAdmediaData(startDate: string, endDate: string): Promise<AdmediaApiResponse> {
    if (!ADMEDIA_AID || !ADMEDIA_API_KEY) {
        return { success: false, data: null, error: "Admedia API credentials not configured" };
    }

    try {
        // Admedia Publisher API endpoint for stats
        const url = `${ADMEDIA_API_BASE}/stats?aid=${ADMEDIA_AID}&start_date=${startDate}&end_date=${endDate}`;
        
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${ADMEDIA_API_KEY}`,
                "X-API-Key": ADMEDIA_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, data: null, error: `API Error: ${response.status} - ${errorText}` };
        }

        const json = await response.json();
        const data = parseAdmediaResponse(json);

        if (!data) {
            return { success: false, data: null, error: "Failed to parse API response" };
        }

        return { success: true, data };
    } catch (error) {
        return { success: false, data: null, error: `Fetch error: ${error}` };
    }
}

// Calculate proportional Admedia metrics for each AM campaign based on clicks
export interface CampaignAdmediaMetrics {
    campaignId: string;
    admediaLeads: number;
    admediaConversions: number;
    admediaEarnings: number; // In USD
    admediaEarningsInr: number; // In INR
    admediaCPC: number; // Cost per click
    admediaCPL: number; // Cost per lead
    admediaCR: number; // Conversion rate
    actualROAS: number; // Actual ROAS from Admedia data
}

export function calculateCampaignAdmediaMetrics(
    campaigns: Array<{ id: string; name: string; clicks: number; cost: number }>
): Map<string, CampaignAdmediaMetrics> {
    const result = new Map<string, CampaignAdmediaMetrics>();

    // Filter AM campaigns (case insensitive)
    const amCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().endsWith("-am") || admediaCampaignIds.includes(c.id)
    );

    if (amCampaigns.length === 0) return result;

    // Calculate total clicks for AM campaigns
    const totalAMClicks = amCampaigns.reduce((sum, c) => sum + c.clicks, 0);

    if (totalAMClicks === 0) return result;

    // Distribute Admedia metrics proportionally by clicks
    for (const campaign of amCampaigns) {
        const clickRatio = campaign.clicks / totalAMClicks;

        const leads = Math.round(admediaOctoberData.leads * clickRatio);
        const conversions = Math.round(admediaOctoberData.conversions * clickRatio);
        const earnings = admediaOctoberData.earnings * clickRatio;

        // Calculate actual ROAS: (Admedia Earnings in INR) / (Google Ads Cost in INR)
        const earningsInr = earnings * USD_TO_INR;
        const actualROAS = campaign.cost > 0 ? earningsInr / campaign.cost : 0;

        result.set(campaign.id, {
            campaignId: campaign.id,
            admediaLeads: leads,
            admediaConversions: conversions,
            admediaEarnings: Math.round(earnings * 100) / 100,
            admediaEarningsInr: Math.round(earningsInr * 100) / 100,
            admediaCPC: campaign.clicks > 0 ? earnings / campaign.clicks : 0,
            admediaCPL: leads > 0 ? earnings / leads : 0,
            admediaCR: leads > 0 ? (conversions / leads) * 100 : 0,
            actualROAS: Math.round(actualROAS * 100) / 100,
        });
    }

    return result;
}

// Format USD value
export function formatUsd(value: number): string {
    if (value >= 1000) {
        return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(2)}`;
}

// Get Admedia totals
export function getAdmediaTotals() {
    return {
        totalLeads: admediaOctoberData.leads,
        totalConversions: admediaOctoberData.conversions,
        totalEarnings: admediaOctoberData.earnings,
        totalEarningsInr: admediaOctoberData.earningsInr,
        conversionRate: admediaOctoberData.conversionRate,
        cpc: admediaOctoberData.cpc,
        cpl: admediaOctoberData.cpl,
    };
}

// Check if a campaign uses Admedia
export function isAdmediaCampaign(campaignName: string): boolean {
    return campaignName.toLowerCase().endsWith("-am");
}
