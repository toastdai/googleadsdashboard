/**
 * Campaign Data Module
 * Real data from EFF24 Google Ads Account (October 2025)
 */

export interface Campaign {
    id: string;
    name: string;
    status: string;
    statusReasons: string;
    budget: number;
    budgetType: string;
    account: string;
    optimizationScore: number;
    clicks: number;
    impressions: number;
    ctr: number;
    avgCpc: number;
    cost: number;
    bidStrategy: string;
    conversions: number;
    conversionRate: number;
    searchImprShare: number | null;
    searchTopIS: number | null;
    // Kelkoo metrics (for KL campaigns)
    isKelkoo?: boolean;
    kelkooLeads?: number;
    kelkooRevenue?: number; // EUR
    kelkooRevenueInr?: number; // INR
    kelkooSales?: number;
    kelkooSaleValue?: number; // EUR
    kelkooSaleValueInr?: number; // INR
    actualROAS?: number;
    profitability?: number; // Revenue - Cost
    // Admedia metrics (for AM campaigns)
    isAdmedia?: boolean;
    admediaLeads?: number;
    admediaConversions?: number;
    admediaEarnings?: number; // USD
    admediaEarningsInr?: number; // INR
    // AI-based metrics
    predictedROAS?: number;
    healthScore?: number; // 0-100 campaign health score
    efficiencyRating?: string; // A, B, C, D, F
    riskLevel?: string; // Low, Medium, High
    recommendedAction?: string;
}

// Parse percentage strings like "17.88%" to number
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parsePercent = (str: string): number => {
    if (str === "< 10%" || str === "--") return 5; // Approximate for < 10%
    return Number.parseFloat(str.replace("%", "")) || 0;
};

// Parse number strings with commas like "8,012" to number  
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseNum = (str: string): number => {
    return Number.parseFloat(str.replaceAll(",", "")) || 0;
};

// Real campaign data from CSV
export const campaigns: Campaign[] = [
    {
        id: "camp-1",
        name: "Crossbreedholsters-US-PB",
        status: "Enabled",
        statusReasons: "bidding strategy limited",
        budget: 5000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 67.43,
        clicks: 160,
        impressions: 895,
        ctr: 17.88,
        avgCpc: 98.47,
        cost: 15754.92,
        bidStrategy: "Maximize clicks",
        conversions: 64,
        conversionRate: 40.0,
        searchImprShare: 56.92,
        searchTopIS: 50.47,
    },
    {
        id: "camp-2",
        name: "Kohl's - US - AM",
        status: "Enabled",
        statusReasons: "bidding strategy limited",
        budget: 8000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 65.36,
        clicks: 867,
        impressions: 8012,
        ctr: 10.82,
        avgCpc: 37.14,
        cost: 32196.96,
        bidStrategy: "Maximize clicks",
        conversions: 414.34,
        conversionRate: 47.79,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-3",
        name: "Macy's-USA-AM",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 12000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 67.03,
        clicks: 233,
        impressions: 2893,
        ctr: 8.05,
        avgCpc: 43.48,
        cost: 10131.81,
        bidStrategy: "Maximize clicks",
        conversions: 93,
        conversionRate: 39.91,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-4",
        name: "PottersCookShop-UK-KL",
        status: "Enabled",
        statusReasons: "",
        budget: 2000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 89.56,
        clicks: 17,
        impressions: 79,
        ctr: 21.52,
        avgCpc: 92.93,
        cost: 1579.85,
        bidStrategy: "Manual CPC",
        conversions: 9,
        conversionRate: 52.94,
        searchImprShare: 56.84,
        searchTopIS: 45.26,
    },
    {
        id: "camp-5",
        name: "NORD VPN - WW - VC",
        status: "Enabled",
        statusReasons: "bidding strategy learning",
        budget: 5000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 68.26,
        clicks: 188,
        impressions: 1576,
        ctr: 11.93,
        avgCpc: 55.66,
        cost: 10463.31,
        bidStrategy: "Maximize clicks",
        conversions: 94,
        conversionRate: 50.0,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-6",
        name: "VidaXL-UK-KL",
        status: "Enabled",
        statusReasons: "",
        budget: 5000,
        budgetType: "Daily",
        account: "Ashes",
        optimizationScore: 89.56,
        clicks: 187,
        impressions: 668,
        ctr: 27.99,
        avgCpc: 61.60,
        cost: 11519.35,
        bidStrategy: "Maximize clicks",
        conversions: 117,
        conversionRate: 62.57,
        searchImprShare: 67.61,
        searchTopIS: 58.05,
    },
    {
        id: "camp-7",
        name: "wayfair-uk-kl",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 20000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 59.70,
        clicks: 1449,
        impressions: 11127,
        ctr: 13.02,
        avgCpc: 88.88,
        cost: 128785.65,
        bidStrategy: "Manual CPC",
        conversions: 737,
        conversionRate: 50.86,
        searchImprShare: 30.81,
        searchTopIS: 22.89,
    },
    {
        id: "camp-8",
        name: "Cb2-us-pm",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 89.66,
        clicks: 58,
        impressions: 362,
        ctr: 16.02,
        avgCpc: 59.82,
        cost: 3469.54,
        bidStrategy: "Maximize clicks",
        conversions: 31,
        conversionRate: 53.45,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-9",
        name: "mizuno-us-pm",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 89.56,
        clicks: 23,
        impressions: 150,
        ctr: 15.33,
        avgCpc: 68.27,
        cost: 1570.25,
        bidStrategy: "Maximize clicks",
        conversions: 1,
        conversionRate: 4.34,
        searchImprShare: 16.77,
        searchTopIS: 12.83,
    },
    {
        id: "camp-10",
        name: "Stylevana-us-pm",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 89.56,
        clicks: 14,
        impressions: 78,
        ctr: 17.95,
        avgCpc: 76.22,
        cost: 1067.06,
        bidStrategy: "Maximize clicks",
        conversions: 11,
        conversionRate: 78.57,
        searchImprShare: 11.94,
        searchTopIS: 5,
    },
    {
        id: "camp-11",
        name: "alibaba-WW-AD",
        status: "Enabled",
        statusReasons: "bidding strategy limited",
        budget: 5000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 59.38,
        clicks: 289,
        impressions: 1439,
        ctr: 20.08,
        avgCpc: 99.30,
        cost: 28698.40,
        bidStrategy: "Maximize clicks",
        conversions: 136,
        conversionRate: 47.06,
        searchImprShare: 41.83,
        searchTopIS: 36.21,
    },
    {
        id: "camp-12",
        name: "EdibleArrangements-US-IM",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 2000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 64.64,
        clicks: 352,
        impressions: 2041,
        ctr: 17.25,
        avgCpc: 52.72,
        cost: 18558.55,
        bidStrategy: "Maximize clicks",
        conversions: 238,
        conversionRate: 67.61,
        searchImprShare: 15.36,
        searchTopIS: 12.69,
    },
    {
        id: "camp-13",
        name: "Paramount-US-MB",
        status: "Enabled",
        statusReasons: "",
        budget: 10000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 67.34,
        clicks: 875,
        impressions: 5855,
        ctr: 14.94,
        avgCpc: 89.10,
        cost: 77961.12,
        bidStrategy: "Manual CPC",
        conversions: 493.5,
        conversionRate: 56.40,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-14",
        name: "Roman-UK-KL",
        status: "Enabled",
        statusReasons: "bidding strategy learning",
        budget: 8000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 67.78,
        clicks: 2148,
        impressions: 9358,
        ctr: 22.95,
        avgCpc: 57.45,
        cost: 123399.98,
        bidStrategy: "Maximize clicks",
        conversions: 1040.04,
        conversionRate: 48.42,
        searchImprShare: 46.43,
        searchTopIS: 37.22,
    },
    {
        id: "camp-15",
        name: "MottandBow-US-KL",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 5000,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 68.43,
        clicks: 135,
        impressions: 833,
        ctr: 16.21,
        avgCpc: 121.72,
        cost: 16432.22,
        bidStrategy: "Manual CPC",
        conversions: 61,
        conversionRate: 45.18,
        searchImprShare: 53.74,
        searchTopIS: 45.08,
    },
    {
        id: "camp-16",
        name: "Zenni optical-us-am",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 6500,
        budgetType: "Daily",
        account: "RKT",
        optimizationScore: 65.56,
        clicks: 1423,
        impressions: 8376,
        ctr: 16.99,
        avgCpc: 60.17,
        cost: 85621.02,
        bidStrategy: "Manual CPC",
        conversions: 952.51,
        conversionRate: 66.94,
        searchImprShare: 16.52,
        searchTopIS: 13.07,
    },
    {
        id: "camp-17",
        name: "Adameve-us-AM",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 89.56,
        clicks: 12,
        impressions: 166,
        ctr: 7.23,
        avgCpc: 83.44,
        cost: 1001.24,
        bidStrategy: "Maximize clicks",
        conversions: 6,
        conversionRate: 50.0,
        searchImprShare: 14.01,
        searchTopIS: 11.85,
    },
    {
        id: "camp-18",
        name: "Expondo-UK-KL",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 89.56,
        clicks: 19,
        impressions: 42,
        ctr: 45.24,
        avgCpc: 97.36,
        cost: 1849.92,
        bidStrategy: "Manual CPC",
        conversions: 11,
        conversionRate: 57.89,
        searchImprShare: 76.19,
        searchTopIS: 66.67,
    },
    {
        id: "camp-19",
        name: "Bluehost-WW-MB",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 89.66,
        clicks: 31,
        impressions: 185,
        ctr: 16.76,
        avgCpc: 48.91,
        cost: 1516.20,
        bidStrategy: "Maximize clicks",
        conversions: 18,
        conversionRate: 58.06,
        searchImprShare: 5,
        searchTopIS: 5,
    },
    {
        id: "camp-20",
        name: "Stylevana-US-PB",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 89.56,
        clicks: 33,
        impressions: 246,
        ctr: 13.41,
        avgCpc: 85.75,
        cost: 2829.68,
        bidStrategy: "Maximize clicks",
        conversions: 13,
        conversionRate: 39.39,
        searchImprShare: 20.59,
        searchTopIS: 14.08,
    },
    {
        id: "camp-21",
        name: "VineyardVines-WW-MB",
        status: "Enabled",
        statusReasons: "",
        budget: 500,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 89.56,
        clicks: 52,
        impressions: 524,
        ctr: 9.92,
        avgCpc: 119.04,
        cost: 6190.10,
        bidStrategy: "Maximize clicks",
        conversions: 25,
        conversionRate: 48.08,
        searchImprShare: 19.52,
        searchTopIS: 14.25,
    },
    {
        id: "camp-22",
        name: "Sling TV-USA-MB",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 2000,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 63.89,
        clicks: 10,
        impressions: 42,
        ctr: 23.81,
        avgCpc: 94.40,
        cost: 944.04,
        bidStrategy: "Manual CPC",
        conversions: 1,
        conversionRate: 10.0,
        searchImprShare: 16.50,
        searchTopIS: 13.50,
    },
    {
        id: "camp-23",
        name: "EdibleArrangements-CA-IM",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 2000,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 68.91,
        clicks: 60,
        impressions: 221,
        ctr: 27.15,
        avgCpc: 46.32,
        cost: 2779.16,
        bidStrategy: "Maximize clicks",
        conversions: 32,
        conversionRate: 53.33,
        searchImprShare: 48.40,
        searchTopIS: 45.55,
    },
    {
        id: "camp-24",
        name: "Pmall-MB",
        status: "Enabled",
        statusReasons: "limited by bidding strategy type",
        budget: 36000,
        budgetType: "Daily",
        account: "SRH",
        optimizationScore: 73.64,
        clicks: 3681,
        impressions: 22001,
        ctr: 16.73,
        avgCpc: 134.11,
        cost: 493648.21,
        bidStrategy: "Maximize clicks",
        conversions: 1472.04,
        conversionRate: 39.99,
        searchImprShare: 52.01,
        searchTopIS: 45.32,
    },
];

// Aggregated metrics
export const totals = {
    clicks: 12316,
    impressions: 77170,
    cost: 1077968.53,
    conversions: 6070.44,
    ctr: 15.96,
    avgCpc: 87.53,
    conversionRate: 49.29,
    searchImprShare: 16.35,
    searchTopIS: 12.51,
    totalBudget: campaigns.reduce((sum, c) => sum + c.budget, 0),
    campaignCount: campaigns.length,
};

// Account breakdown
export const accountBreakdown = [
    { account: "Ashes", campaigns: 6, cost: 81646.20, clicks: 1652, conversions: 791.34 },
    { account: "RKT", campaigns: 10, cost: 485563.79, clicks: 6766, conversions: 3700.05 },
    { account: "SRH", campaigns: 8, cost: 510758.54, clicks: 3898, conversions: 1579.04 },
];

// Budget strategy breakdown
export const bidStrategyBreakdown = [
    { strategy: "Maximize clicks", campaigns: 18, cost: 683682.67, conversions: 4193.38 },
    { strategy: "Manual CPC", campaigns: 7, cost: 394285.86, conversions: 1877.06 },
];

// Top performers by ROAS (estimated)
export const topPerformers = campaigns
    .filter(c => c.conversions > 10)
    .map(c => ({
        ...c,
        cpa: c.cost / c.conversions,
        estimatedValue: c.conversions * 500, // Estimated Rs.500 per conversion
        roas: (c.conversions * 500) / c.cost,
    }))
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 5);

// Bottom performers
export const bottomPerformers = campaigns
    .filter(c => c.conversions > 0)
    .map(c => ({
        ...c,
        cpa: c.cost / c.conversions,
    }))
    .sort((a, b) => b.cpa - a.cpa)
    .slice(0, 5);

// Daily trend data (simulated from monthly data)
export const dailyTrend = Array.from({ length: 31 }, (_, i) => {
    const day = i + 1;
    const variance = 0.8 + Math.random() * 0.4; // 80-120% variance
    return {
        date: `2025-10-${String(day).padStart(2, "0")}`,
        clicks: Math.round(totals.clicks / 31 * variance),
        impressions: Math.round(totals.impressions / 31 * variance),
        cost: Math.round(totals.cost / 31 * variance),
        conversions: Math.round(totals.conversions / 31 * variance * 10) / 10,
        ctr: Math.round((totals.ctr * variance) * 100) / 100,
    };
});

// Format helpers
export const formatCurrency = (value: number): string => {
    if (value >= 100000) {
        return `Rs.${(value / 100000).toFixed(2)}L`;
    } else if (value >= 1000) {
        return `Rs.${(value / 1000).toFixed(1)}K`;
    }
    return `Rs.${value.toFixed(2)}`;
};

export const formatNumber = (value: number): string => {
    if (value >= 1000000) {
        return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
};

// Kelkoo data integration for KL campaigns
// Total Kelkoo data for Oct 1-31, 2025 - NOW USES LIVE API DATA ONLY
const kelkooTotals = {
    clicks: 0,
    leads: 0,
    revenueEur: 0,
    sales: 0,
    saleValueEur: 0,
    cpc: 0,
    vpl: 0,
};

// Admedia data integration for AM campaigns
// Total Admedia data for Oct 1-31, 2025
const admediaTotals = {
    clicks: 0,
    leads: 0,
    conversions: 0,
    earningsUsd: 0,
};

const EUR_TO_INR = 89.5;
const USD_TO_INR = 83.5;

// AI-based campaign health score calculator
function calculateHealthScore(campaign: Campaign): number {
    let score = 50; // Base score

    // CTR factor (higher is better)
    if (campaign.ctr >= 15) score += 15;
    else if (campaign.ctr >= 10) score += 10;
    else if (campaign.ctr >= 5) score += 5;
    else score -= 10;

    // Conversion rate factor
    if (campaign.conversionRate >= 50) score += 15;
    else if (campaign.conversionRate >= 30) score += 10;
    else if (campaign.conversionRate >= 15) score += 5;
    else score -= 10;

    // Optimization score factor
    if (campaign.optimizationScore >= 80) score += 10;
    else if (campaign.optimizationScore >= 60) score += 5;
    else score -= 5;

    // Status reasons factor
    if (!campaign.statusReasons || campaign.statusReasons === "") score += 10;
    else if (campaign.statusReasons.includes("learning")) score -= 5;
    else if (campaign.statusReasons.includes("limited")) score -= 10;

    return Math.max(0, Math.min(100, score));
}

// AI-based efficiency rating
function calculateEfficiencyRating(campaign: Campaign): string {
    const healthScore = calculateHealthScore(campaign);

    if (healthScore >= 80 && campaign.conversionRate >= 50) return "A";
    if (healthScore >= 65 && campaign.conversionRate >= 35) return "B";
    if (healthScore >= 50 && campaign.conversionRate >= 20) return "C";
    if (healthScore >= 35) return "D";
    return "F";
}

// AI-based risk level assessment
function calculateRiskLevel(campaign: Campaign): string {
    const issues = [];
    
    if (campaign.ctr < 5) issues.push("low_ctr");
    if (campaign.conversionRate < 20) issues.push("low_conv");
    if (campaign.statusReasons?.includes("limited")) issues.push("limited");
    if (campaign.optimizationScore < 60) issues.push("low_opt");
    if ((campaign.searchImprShare || 0) < 20) issues.push("low_share");

    if (issues.length >= 3) return "High";
    if (issues.length >= 1) return "Medium";
    return "Low";
}

// AI-based recommended action
function getRecommendedAction(campaign: Campaign): string {
    const healthScore = calculateHealthScore(campaign);
    const riskLevel = calculateRiskLevel(campaign);

    if (riskLevel === "High") {
        if (campaign.ctr < 5) return "Review ad copy and targeting - CTR critically low";
        if (campaign.conversionRate < 20) return "Optimize landing pages - conversion rate needs improvement";
        return "Comprehensive audit recommended - multiple issues detected";
    }

    if (healthScore >= 80) return "Increase budget - campaign performing excellently";
    if (healthScore >= 60) return "Monitor closely - consider A/B testing";
    if (campaign.statusReasons?.includes("learning")) return "Allow learning phase to complete";
    if (campaign.statusReasons?.includes("limited")) return "Adjust bidding strategy or budget";

    return "Review campaign settings and targeting";
}

// Enrich campaigns with Kelkoo, Admedia, and AI metrics
export const enrichedCampaigns: Campaign[] = campaigns.map(campaign => {
    // Check if campaign ends with KL or AM (case insensitive)
    const isKelkoo = campaign.name.toLowerCase().endsWith("-kl");
    const isAdmedia = campaign.name.toLowerCase().endsWith("-am");

    // Calculate AI metrics for all campaigns
    const healthScore = calculateHealthScore(campaign);
    const efficiencyRating = calculateEfficiencyRating(campaign);
    const riskLevel = calculateRiskLevel(campaign);
    const recommendedAction = getRecommendedAction(campaign);

    // Predicted ROAS based on current performance trends
    const baseRoas = campaign.conversions > 0 ? (campaign.conversions * 500) / campaign.cost : 0;
    const predictedROAS = Math.round(baseRoas * (1 + (healthScore - 50) / 100) * 100) / 100;

    // Base campaign with AI metrics
    const baseCampaign = {
        ...campaign,
        healthScore,
        efficiencyRating,
        riskLevel,
        recommendedAction,
        predictedROAS,
    };

    // Handle Kelkoo campaigns
    if (isKelkoo) {
        const klCampaigns = campaigns.filter(c => c.name.toLowerCase().endsWith("-kl"));
        const totalKLClicks = klCampaigns.reduce((sum, c) => sum + c.clicks, 0);
        const clickRatio = totalKLClicks > 0 ? campaign.clicks / totalKLClicks : 0;

        const kelkooLeads = Math.round(kelkooTotals.leads * clickRatio);
        const kelkooRevenue = Math.round(kelkooTotals.revenueEur * clickRatio * 100) / 100;
        const kelkooSales = Math.round(kelkooTotals.sales * clickRatio);
        const kelkooSaleValue = Math.round(kelkooTotals.saleValueEur * clickRatio * 100) / 100;

        const kelkooRevenueInr = Math.round(kelkooRevenue * EUR_TO_INR * 100) / 100;
        const kelkooSaleValueInr = Math.round(kelkooSaleValue * EUR_TO_INR * 100) / 100;

        const totalRevenueInr = kelkooRevenueInr + kelkooSaleValueInr;
        const actualROAS = campaign.cost > 0 ? Math.round((totalRevenueInr / campaign.cost) * 100) / 100 : 0;
        const profitability = Math.round((totalRevenueInr - campaign.cost) * 100) / 100;

        return {
            ...baseCampaign,
            isKelkoo: true,
            isAdmedia: false,
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

    // Handle Admedia campaigns
    if (isAdmedia) {
        const amCampaigns = campaigns.filter(c => c.name.toLowerCase().endsWith("-am"));
        const totalAMClicks = amCampaigns.reduce((sum, c) => sum + c.clicks, 0);
        const clickRatio = totalAMClicks > 0 ? campaign.clicks / totalAMClicks : 0;

        const admediaLeads = Math.round(admediaTotals.leads * clickRatio);
        const admediaConversions = Math.round(admediaTotals.conversions * clickRatio);
        const admediaEarnings = Math.round(admediaTotals.earningsUsd * clickRatio * 100) / 100;
        const admediaEarningsInr = Math.round(admediaEarnings * USD_TO_INR * 100) / 100;

        const actualROAS = campaign.cost > 0 ? Math.round((admediaEarningsInr / campaign.cost) * 100) / 100 : 0;
        const profitability = Math.round((admediaEarningsInr - campaign.cost) * 100) / 100;

        return {
            ...baseCampaign,
            isKelkoo: false,
            isAdmedia: true,
            admediaLeads,
            admediaConversions,
            admediaEarnings,
            admediaEarningsInr,
            actualROAS,
            profitability,
        };
    }

    return { ...baseCampaign, isKelkoo: false, isAdmedia: false };
}).sort((a, b) => {
    // Sort by data source first: KL, then AM, then others
    if (a.isKelkoo && !b.isKelkoo) return -1;
    if (!a.isKelkoo && b.isKelkoo) return 1;
    if (a.isAdmedia && !b.isAdmedia) return -1;
    if (!a.isAdmedia && b.isAdmedia) return 1;
    // Then sort by cost (highest first)
    return (b.cost || 0) - (a.cost || 0);
});

// Kelkoo totals for KL campaigns (CORRECTED values)
export const kelkooAggregates = {
    totalLeads: kelkooTotals.leads,
    totalRevenueEur: kelkooTotals.revenueEur,
    totalRevenueInr: Math.round(kelkooTotals.revenueEur * EUR_TO_INR * 100) / 100,
    totalSales: kelkooTotals.sales,
    totalSaleValueEur: kelkooTotals.saleValueEur,
    totalSaleValueInr: Math.round(kelkooTotals.saleValueEur * EUR_TO_INR * 100) / 100,
    cpc: kelkooTotals.cpc,
    vpl: kelkooTotals.vpl,
    conversionRate: (kelkooTotals.sales / kelkooTotals.leads) * 100,
    klCampaignCount: campaigns.filter(c => c.name.toLowerCase().endsWith("-kl")).length,
};

// Admedia totals for AM campaigns
export const admediaAggregates = {
    totalLeads: admediaTotals.leads,
    totalConversions: admediaTotals.conversions,
    totalEarningsUsd: admediaTotals.earningsUsd,
    totalEarningsInr: Math.round(admediaTotals.earningsUsd * USD_TO_INR * 100) / 100,
    conversionRate: admediaTotals.leads > 0 ? (admediaTotals.conversions / admediaTotals.leads) * 100 : 0,
    amCampaignCount: campaigns.filter(c => c.name.toLowerCase().endsWith("-am")).length,
};

// AI-based aggregate metrics
export const aiMetrics = {
    averageHealthScore: Math.round(enrichedCampaigns.reduce((sum, c) => sum + (c.healthScore || 0), 0) / enrichedCampaigns.length),
    highPerformers: enrichedCampaigns.filter(c => c.efficiencyRating === "A" || c.efficiencyRating === "B").length,
    atRiskCampaigns: enrichedCampaigns.filter(c => c.riskLevel === "High").length,
    needsAttention: enrichedCampaigns.filter(c => c.riskLevel === "Medium").length,
    totalPredictedROAS: Math.round(enrichedCampaigns.reduce((sum, c) => sum + (c.predictedROAS || 0), 0) / enrichedCampaigns.length * 100) / 100,
};
