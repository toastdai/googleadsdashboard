/**
 * Kelkoo API Integration Service
 * Fetches revenue and lead data from Kelkoo Reporting API for KL campaigns
 */

// Safe toFixed wrapper to prevent errors on null/undefined/non-numeric values
const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return "0";
    return num.toFixed(decimals);
};

// Kelkoo API configuration
const KELKOO_API_BASE = "https://api.kelkoogroup.net/publisher/reports/v1";
const KELKOO_API_TOKEN = process.env.NEXT_PUBLIC_KELKOO_API_TOKEN || "";

export interface KelkooMetrics {
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

export interface KelkooApiResponse {
    success: boolean;
    data: KelkooMetrics | null;
    error?: string;
}

// Parse TSV response from Kelkoo API
function parseTsvResponse(tsv: string): KelkooMetrics | null {
    const lines = tsv.trim().split("\n");
    if (lines.length < 2) return null;

    const headers = lines[0].split("\t");
    const values = lines[1].split("\t");

    const parseNumber = (val: string): number => {
        if (!val || val === "") return 0;
        // Remove % sign and parse
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

// Fetch aggregated Kelkoo data for a date range
export async function fetchKelkooData(startDate: string, endDate: string): Promise<KelkooApiResponse> {
    if (!KELKOO_API_TOKEN) {
        return { success: false, data: null, error: "Kelkoo API token not configured" };
    }

    try {
        const url = `${KELKOO_API_BASE}/aggregated?start=${startDate}&end=${endDate}`;
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${KELKOO_API_TOKEN}`,
                "Accept-Encoding": "gzip",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return { success: false, data: null, error: `API Error: ${response.status} - ${errorText}` };
        }

        const text = await response.text();
        const data = parseTsvResponse(text);

        if (!data) {
            return { success: false, data: null, error: "Failed to parse API response" };
        }

        return { success: true, data };
    } catch (error) {
        return { success: false, data: null, error: `Fetch error: ${error}` };
    }
}

// Static Kelkoo data for Oct 1-31, 2025 (CORRECTED to match actual Kelkoo dashboard)
// This data was verified against the Kelkoo dashboard screenshot on 2025-12-08
export const kelkooOctoberData: KelkooMetrics = {
    clickCount: 5252,
    clickValidCount: 5101,
    leadCount: 4507,  // Corrected from 4651 to match screenshot
    trackedLeadCount: 4507,
    leadEstimatedRevenueInEur: 3974.21,  // Corrected from 4158.34 to match screenshot
    leadRejectedCount: 450,
    saleCount: 417,  // Corrected from 427 to match screenshot
    saleValueInEur: 51393.35,  // Corrected from 53035.42 to match screenshot
    monetizedClickPercentage: 97.12,
    crPercentage: 9.25,  // Recalculated: 417/4507 * 100
    valuePerLeadInEur: 11.4,  // From screenshot VPL
};

// Campaigns that use Kelkoo (ending with -KL)
export const kelkooCampaignIds = [
    "camp-4",  // PottersCookShop-UK-KL
    "camp-6",  // VidaXL-UK-KL
    "camp-7",  // wayfair-uk-kl
    "camp-14", // Roman-UK-KL
    "camp-15", // MottandBow-US-KL
    "camp-18", // Expondo-UK-KL
];

// EUR to INR conversion rate (approximate)
export const EUR_TO_INR = 89.5;

// Calculate proportional Kelkoo metrics for each KL campaign based on clicks
export interface CampaignKelkooMetrics {
    campaignId: string;
    kelkooLeads: number;
    kelkooRevenue: number; // In EUR
    kelkooRevenueInr: number; // In INR
    kelkooSales: number;
    kelkooSaleValue: number; // In EUR
    kelkooSaleValueInr: number; // In INR
    kelkooCR: number; // Conversion rate
    kelkooRPL: number; // Revenue per lead
    actualROAS: number; // Actual ROAS from Kelkoo data
}

export function calculateCampaignKelkooMetrics(
    campaigns: Array<{ id: string; name: string; clicks: number; cost: number }>
): Map<string, CampaignKelkooMetrics> {
    const result = new Map<string, CampaignKelkooMetrics>();

    // Filter KL campaigns
    const klCampaigns = campaigns.filter(c =>
        c.name.toLowerCase().endsWith("-kl") || kelkooCampaignIds.includes(c.id)
    );

    if (klCampaigns.length === 0) return result;

    // Calculate total clicks for KL campaigns
    const totalKLClicks = klCampaigns.reduce((sum, c) => sum + c.clicks, 0);

    if (totalKLClicks === 0) return result;

    // Distribute Kelkoo metrics proportionally by clicks
    for (const campaign of klCampaigns) {
        const clickRatio = campaign.clicks / totalKLClicks;

        const leads = Math.round(kelkooOctoberData.leadCount * clickRatio);
        const revenue = kelkooOctoberData.leadEstimatedRevenueInEur * clickRatio;
        const sales = Math.round(kelkooOctoberData.saleCount * clickRatio);
        const saleValue = kelkooOctoberData.saleValueInEur * clickRatio;

        // Calculate actual ROAS: (Kelkoo Revenue in INR) / (Google Ads Cost in INR)
        const revenueInr = revenue * EUR_TO_INR;
        const saleValueInr = saleValue * EUR_TO_INR;
        const actualROAS = campaign.cost > 0 ? (revenueInr + saleValueInr) / campaign.cost : 0;

        result.set(campaign.id, {
            campaignId: campaign.id,
            kelkooLeads: leads,
            kelkooRevenue: Math.round(revenue * 100) / 100,
            kelkooRevenueInr: Math.round(revenueInr * 100) / 100,
            kelkooSales: sales,
            kelkooSaleValue: Math.round(saleValue * 100) / 100,
            kelkooSaleValueInr: Math.round(saleValueInr * 100) / 100,
            kelkooCR: leads > 0 ? (sales / leads) * 100 : 0,
            kelkooRPL: leads > 0 ? revenue / leads : 0,
            actualROAS: Math.round(actualROAS * 100) / 100,
        });
    }

    return result;
}

// Format EUR value
export function formatEur(value: number): string {
    if (value >= 1000) {
        return `€${safeToFixed(value / 1000, 1)}K`;
    }
    return `€${safeToFixed(value, 2)}`;
}

// Get Kelkoo totals
export function getKelkooTotals() {
    return {
        totalLeads: kelkooOctoberData.leadCount,
        totalRevenue: kelkooOctoberData.leadEstimatedRevenueInEur,
        totalRevenueInr: kelkooOctoberData.leadEstimatedRevenueInEur * EUR_TO_INR,
        totalSales: kelkooOctoberData.saleCount,
        totalSaleValue: kelkooOctoberData.saleValueInEur,
        totalSaleValueInr: kelkooOctoberData.saleValueInEur * EUR_TO_INR,
        conversionRate: kelkooOctoberData.crPercentage,
        revenuePerLead: kelkooOctoberData.valuePerLeadInEur,
    };
}
