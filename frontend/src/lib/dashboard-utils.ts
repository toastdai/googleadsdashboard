import { MetricTimeSeries, BreakdownItem } from "@/hooks/useDashboardData";

export interface DashboardChartData {
    date: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    conversion_value: number;
    ctr: number;
    cpc: number;
    roas: number;
}

export function transformTimeSeries(timeSeries: MetricTimeSeries[]): DashboardChartData[] {
    if (!timeSeries.length) return [];

    // Group by date
    const dataByDate: Record<string, Partial<DashboardChartData>> = {};

    timeSeries.forEach(series => {
        series.data.forEach(point => {
            if (!dataByDate[point.date]) {
                dataByDate[point.date] = { date: point.date };
            }
            // @ts-ignore
            dataByDate[point.date][series.metric as keyof DashboardChartData] = point.value;
        });
    });

    // Convert to array and calculate derived metrics
    return Object.values(dataByDate).map(item => {
        const clicks = item.clicks || 0;
        const impressions = item.impressions || 0;
        const cost = item.cost || 0;
        const conversions = item.conversions || 0;
        const conversion_value = item.conversion_value || 0;

        return {
            date: item.date || "",
            clicks,
            impressions,
            cost,
            conversions,
            conversion_value,
            ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
            cpc: clicks > 0 ? cost / clicks : 0,
            roas: cost > 0 ? conversion_value / cost : 0
        };
    }).sort((a, b) => a.date.localeCompare(b.date));
}

// AI-based campaign health score calculator
export function calculateHealthScore(campaign: BreakdownItem): number {
    let score = 50; // Base score

    // CTR factor (higher is better)
    if (campaign.ctr >= 15) score += 15;
    else if (campaign.ctr >= 10) score += 10;
    else if (campaign.ctr >= 5) score += 5;
    else score -= 10;

    // Conversion rate (approximate from conversions/clicks if not present)
    const cvr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;

    if (cvr >= 50) score += 15;
    else if (cvr >= 30) score += 10;
    else if (cvr >= 15) score += 5;
    else score -= 10;

    return Math.max(0, Math.min(100, score));
}

export function calculateEfficiencyRating(campaign: BreakdownItem): string {
    const healthScore = calculateHealthScore(campaign);
    const cvr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;

    if (healthScore >= 80 && cvr >= 50) return "A";
    if (healthScore >= 65 && cvr >= 35) return "B";
    if (healthScore >= 50 && cvr >= 20) return "C";
    if (healthScore >= 35) return "D";
    return "F";
}

export function calculateRiskLevel(campaign: BreakdownItem): string {
    const issues = [];
    const cvr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;

    if (campaign.ctr < 3) issues.push("low_ctr");
    if (cvr < 15) issues.push("low_conv");

    if (issues.length >= 2) return "High";
    if (issues.length >= 1) return "Medium";
    return "Low";
}
