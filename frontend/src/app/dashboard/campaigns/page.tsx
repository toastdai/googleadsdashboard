"use client";

import { useState, useMemo } from "react";
import { DataTable } from "@/components/data-table";
import { MetricsLineChart, ChartSkeleton } from "@/components/charts";
import { Campaign } from "@/lib/campaign-data";
import { useKelkooData, calculateCampaignKelkooData } from "@/hooks/useKelkooData";
import { useAdmediaData, calculateCampaignAdmediaData } from "@/hooks/useAdmediaData";
import { useMaxBountyData, calculateCampaignMaxBountyData } from "@/hooks/useMaxBountyData";
import { useDashboardData, BreakdownItem } from "@/hooks/useDashboardData";
import { useDateRange } from "@/lib/date-context";
import { calculateHealthScore, calculateEfficiencyRating, calculateRiskLevel } from "@/lib/dashboard-utils";

// Safe toFixed wrapper to prevent errors on null/undefined/non-numeric values
const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return "0";
    return num.toFixed(decimals);
};

// Helper to detect network from campaign name
const detectNetwork = (name: string) => {
    const nameLower = name.toLowerCase();
    return {
        isKelkoo: /[\s-]+kl$/i.test(nameLower),
        isAdmedia: /[\s-]+am$/i.test(nameLower),
        isMaxBounty: /[\s-]+mb$/i.test(nameLower),
    };
};

// Generate campaign performance data based on campaigns
function generateCampaignTrendData(campaignData: DisplayCampaign[], days: number = 7) {
    const data: { date: string; [key: string]: string | number }[] = [];
    const today = new Date();
    const topCampaigns = [...campaignData]
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 4);
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dayData: { date: string; [key: string]: string | number } = {
            date: date.toISOString().split("T")[0],
        };
        
        topCampaigns.forEach(camp => {
            // Generate variation based on campaign's actual impressions
            const baseImpressions = camp.impressions / days;
            dayData[camp.name] = Math.round(baseImpressions * (0.8 + Math.random() * 0.4));
        });
        
        data.push(dayData);
    }
    return { data, topCampaigns };
}

// Extended campaign type for display
interface DisplayCampaign extends Partial<Campaign> {
    id: string;
    name: string;
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
    ctr: number;
    roas: number;
    spend_rate: number;
    type: string;
    network: string;
    partnerRevenue?: number;
    status: string;
    healthScore?: number;
    efficiencyRating?: string;
    riskLevel?: string;
    conversionRate?: number;
    avgCpc?: number;
    cpa?: number;
}

export default function CampaignsPage() {
    const [selectedCampaign, setSelectedCampaign] = useState<DisplayCampaign | null>(null);
    const [statusFilter, setStatusFilter] = useState<"all" | "Enabled" | "Paused">("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [networkFilter, setNetworkFilter] = useState<string>("all");

    // Global date range from context (shared with dashboard and reports)
    const { dateRange } = useDateRange();
    const startDate = dateRange.start;
    const endDate = dateRange.end;

    // Fetch backend campaign data (auto-fetches live if not in DB)
    const { 
        topCampaigns: backendCampaigns, 
        loading: backendLoading,
        isFetchingLive,
        dataSource 
    } = useDashboardData(startDate, endDate);

    // Fetch partner data
    const { data: kelkooData, loading: kelkooLoading, refetch: refetchKelkoo } = useKelkooData(startDate, endDate);
    const { data: admediaData, loading: admediaLoading, refetch: refetchAdmedia } = useAdmediaData(startDate, endDate);
    const { data: maxBountyData, loading: maxBountyLoading, refetch: refetchMaxBounty } = useMaxBountyData(startDate, endDate);

    const isLoading = backendLoading || isFetchingLive || kelkooLoading || admediaLoading || maxBountyLoading;

    // Enrich campaigns with partner data and computed fields
    const enrichedCampaigns: DisplayCampaign[] = useMemo(() => {
        // Calculate total clicks for each network
        const totalKLClicks = backendCampaigns.filter(c => detectNetwork(c.name).isKelkoo).reduce((sum, c) => sum + c.clicks, 0);
        const totalAMClicks = backendCampaigns.filter(c => detectNetwork(c.name).isAdmedia).reduce((sum, c) => sum + c.clicks, 0);
        const totalMBClicks = backendCampaigns.filter(c => detectNetwork(c.name).isMaxBounty).reduce((sum, c) => sum + c.clicks, 0);

        return backendCampaigns.map(camp => {
            const network = detectNetwork(camp.name);
            let partnerRevenue = 0;
            let partnerLeads = 0;
            let networkName = "Google Ads";

            if (network.isKelkoo && kelkooData) {
                const kelkooMetrics = calculateCampaignKelkooData(kelkooData, camp.clicks, totalKLClicks, camp.cost);
                partnerRevenue = kelkooMetrics.kelkooRevenueInr || 0;
                partnerLeads = kelkooMetrics.kelkooLeads || 0;
                networkName = "Kelkoo";
            } else if (network.isAdmedia && admediaData) {
                const admediaMetrics = calculateCampaignAdmediaData(admediaData, camp.clicks, totalAMClicks, camp.cost);
                partnerRevenue = admediaMetrics.admediaEarningsInr || 0;
                partnerLeads = admediaMetrics.admediaLeads || 0;
                networkName = "Admedia";
            } else if (network.isMaxBounty && maxBountyData) {
                const mbMetrics = calculateCampaignMaxBountyData(maxBountyData, camp.clicks, totalMBClicks, camp.cost);
                partnerRevenue = mbMetrics.maxBountyEarningsInr || 0;
                partnerLeads = mbMetrics.maxBountyLeads || 0;
                networkName = "MaxBounty";
            }

            // Calculate ROAS - use partner revenue if available, else conversion_value
            const conversionValue = camp.conversion_value || 0;
            const effectiveRevenue = partnerRevenue > 0 ? partnerRevenue : conversionValue;
            const roas = camp.cost > 0 ? effectiveRevenue / camp.cost : 0;

            // Calculate spend rate (budget utilization) - use 0 if no budget info
            const spend_rate = 0; // Backend doesn't provide budget info

            // Calculate derived metrics
            const avgCpc = camp.clicks > 0 ? camp.cost / camp.clicks : 0;
            const conversionRate = camp.clicks > 0 ? (camp.conversions / camp.clicks) * 100 : 0;
            const cpa = camp.conversions > 0 ? camp.cost / camp.conversions : 0;

            // Calculate AI metrics
            const healthScore = calculateHealthScore(camp as BreakdownItem);
            const efficiencyRating = calculateEfficiencyRating(camp as BreakdownItem);
            const riskLevel = calculateRiskLevel(camp as BreakdownItem);

            // Determine campaign type from name
            let type = "SEARCH";
            const nameLower = camp.name.toLowerCase();
            if (nameLower.includes("shopping") || nameLower.includes("shop")) type = "SHOPPING";
            else if (nameLower.includes("display")) type = "DISPLAY";
            else if (nameLower.includes("video") || nameLower.includes("youtube")) type = "VIDEO";
            else if (nameLower.includes("pmax") || nameLower.includes("performance max")) type = "PERFORMANCE_MAX";

            return {
                id: camp.id?.toString() || camp.name,
                name: camp.name,
                clicks: camp.clicks,
                impressions: camp.impressions,
                cost: camp.cost,
                conversions: camp.conversions,
                ctr: camp.ctr,
                avgCpc,
                conversionRate,
                cpa,
                roas,
                spend_rate,
                type,
                network: networkName,
                partnerRevenue,
                status: "Enabled",
                healthScore,
                efficiencyRating,
                riskLevel,
                isKelkoo: network.isKelkoo,
                isAdmedia: network.isAdmedia,
                isMaxBounty: network.isMaxBounty,
                kelkooLeads: network.isKelkoo ? partnerLeads : undefined,
                admediaLeads: network.isAdmedia ? partnerLeads : undefined,
                maxBountyLeads: network.isMaxBounty ? partnerLeads : undefined,
            } as DisplayCampaign;
        });
    }, [backendCampaigns, kelkooData, admediaData, maxBountyData]);

    const filteredCampaigns = enrichedCampaigns.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (typeFilter !== "all" && c.type !== typeFilter) return false;
        if (networkFilter !== "all") {
            if (networkFilter === "kelkoo" && !c.isKelkoo) return false;
            if (networkFilter === "admedia" && !c.isAdmedia) return false;
            if (networkFilter === "maxbounty" && !c.isMaxBounty) return false;
            if (networkFilter === "google" && (c.isKelkoo || c.isAdmedia || c.isMaxBounty)) return false;
        }
        return true;
    });

    const campaignTypes = Array.from(new Set(enrichedCampaigns.map((c) => c.type)));
    
    // Campaign selection for comparison chart
    const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
    
    // Generate trend data based on filters and selection
    const { data: trendData, topCampaigns } = useMemo(() => {
        // If specific campaigns are selected, use those; otherwise use filtered campaigns
        const campaignsToChart = selectedCampaignIds.length > 0
            ? filteredCampaigns.filter(c => selectedCampaignIds.includes(c.id))
            : filteredCampaigns;
        return generateCampaignTrendData(campaignsToChart, 7);
    }, [filteredCampaigns, selectedCampaignIds]);
    
    // Toggle campaign selection
    const toggleCampaignSelection = (campaignId: string) => {
        setSelectedCampaignIds(prev => 
            prev.includes(campaignId) 
                ? prev.filter(id => id !== campaignId)
                : [...prev, campaignId]
        );
    };
    
    // Clear campaign selection
    const clearCampaignSelection = () => setSelectedCampaignIds([]);

    const handleRefresh = () => {
        // Refetch partner data - backend data auto-refetches when date range changes
        refetchKelkoo();
        refetchAdmedia();
        refetchMaxBounty();
    };

    const columns = [
        {
            key: "name",
            header: "Campaign",
            sortable: true,
            render: (value: string, row: DisplayCampaign) => (
                <div>
                    <button
                        className="font-medium hover:text-primary-500 transition-colors text-left"
                        onClick={() => setSelectedCampaign(row)}
                    >
                        {value}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{row.type}</span>
                        {row.isKelkoo && <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-[10px] rounded">KL</span>}
                        {row.isAdmedia && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded">AM</span>}
                        {row.isMaxBounty && <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[10px] rounded">MB</span>}
                    </div>
                </div>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (value: string) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value === "Enabled" ? "bg-success-100 text-success-600" : "bg-muted text-muted-foreground"}`}>
                    {value.toUpperCase()}
                </span>
            ),
        },
        { key: "impressions", header: "Impressions", format: "number" as const, align: "right" as const, sortable: true },
        { key: "clicks", header: "Clicks", format: "number" as const, align: "right" as const, sortable: true },
        { key: "cost", header: "Cost", format: "currency" as const, align: "right" as const, sortable: true },
        { key: "conversions", header: "Conv.", format: "number" as const, align: "right" as const, sortable: true },
        { key: "ctr", header: "CTR", format: "percent" as const, align: "right" as const, sortable: true },
        {
            key: "roas",
            header: "ROAS",
            align: "right" as const,
            sortable: true,
            render: (value: number, row: DisplayCampaign) => (
                <span className={`font-medium ${value >= 1 ? "text-success-500" : value > 0 ? "text-warning-500" : "text-muted-foreground"}`}>
                    {value > 0 ? `${safeToFixed(value, 2)}x` : "-"}
                </span>
            ),
        },
        {
            key: "spend_rate",
            header: "Budget",
            align: "right" as const,
            render: (value: number) => (
                <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${value > 90 ? "bg-warning-500" : "bg-primary-500"}`}
                            style={{ width: `${value}%` }}
                        />
                    </div>
                    <span className="text-xs tabular-nums">{safeToFixed(value, 0)}%</span>
                </div>
            ),
        },
    ];

    // Stats calculations - ensure proper number handling for Decimal values from backend
    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + (Number(c.cost) || 0), 0);
    const totalConversions = filteredCampaigns.reduce((sum, c) => sum + (Number(c.conversions) || 0), 0);
    const campaignsWithRoas = filteredCampaigns.filter(c => c.roas > 0);
    const avgRoas = campaignsWithRoas.length > 0 
        ? filteredCampaigns.reduce((sum, c) => sum + (Number(c.roas) || 0), 0) / campaignsWithRoas.length 
        : 0;
    // Use health score average instead of optimization score (not available from backend)
    const avgHealthScore = filteredCampaigns.length > 0
        ? filteredCampaigns.reduce((sum, c) => sum + (c.healthScore || 0), 0) / filteredCampaigns.length
        : 0;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold">Campaigns</h1>
                    <p className="text-muted-foreground mt-1">
                        {backendCampaigns.length > 0 ? `${backendCampaigns.length} campaigns from Google Ads` : 
                         isFetchingLive ? "Fetching live data from Google Ads API..." : 
                         backendLoading ? "Loading campaigns..." : "No Google Ads data for selected period"}
                        {(kelkooLoading || admediaLoading || maxBountyLoading) && 
                            <span className="ml-2 text-cyan-400">(Loading partner data...)</span>
                        }
                    </p>
                    {dataSource === 'live' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            Live from Google Ads API
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-secondary text-sm" onClick={handleRefresh}>
                        <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <button className="btn-primary text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export
                    </button>
                </div>
            </div>

            {/* Live Data Fetching Indicator */}
            {isFetchingLive && (
                <div className="bg-gradient-to-r from-cyan-900/30 via-gray-900 to-purple-900/30 border border-cyan-500/30 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                            <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                        <div>
                            <p className="text-white font-medium">Fetching Historical Data from Google Ads API...</p>
                            <p className="text-gray-400 text-xs mt-0.5">No cached data found. Fetching real-time data. This may take 10-30 seconds.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Google Ads Data Warning */}
            {!backendLoading && !isFetchingLive && backendCampaigns.length === 0 && (
                <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="text-amber-400 font-medium text-sm">No Google Ads Data Available</p>
                            <p className="text-gray-400 text-xs mt-1">Could not fetch data for this date range. This might be due to: no campaigns running, API access issues, or no activity. Partner data (Kelkoo, Admedia, MaxBounty) may still be available.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold text-primary-500">{filteredCampaigns.length}</p>
                    <p className="text-xs text-muted-foreground">Total Campaigns</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold text-success-500">{filteredCampaigns.filter(c => c.status === "Enabled").length}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold text-warning-500">₹{totalSpend >= 100000 ? safeToFixed(totalSpend / 100000, 1) + 'L' : safeToFixed(totalSpend, 0)}</p>
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{safeToFixed(totalConversions, 0)}</p>
                    <p className="text-xs text-muted-foreground">Conversions</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className={`text-2xl font-bold ${avgRoas >= 1 ? "text-cyan-500" : "text-red-400"}`}>{avgRoas > 0 ? safeToFixed(avgRoas, 2) : "-"}x</p>
                    <p className="text-xs text-muted-foreground">Avg ROAS</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4 text-center">
                    <p className="text-2xl font-bold text-purple-500">{safeToFixed(avgHealthScore, 0)}</p>
                    <p className="text-xs text-muted-foreground">Avg Health Score</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-card rounded-xl border border-border">
                <div>
                    <label htmlFor="statusFilter" className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <select
                        id="statusFilter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="input py-2"
                    >
                        <option value="all">All Statuses</option>
                        <option value="Enabled">Enabled</option>
                        <option value="Paused">Paused</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="typeFilter" className="text-xs text-muted-foreground mb-1 block">Campaign Type</label>
                    <select
                        id="typeFilter"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="input py-2"
                    >
                        <option value="all">All Types</option>
                        {campaignTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="networkFilter" className="text-xs text-muted-foreground mb-1 block">Partner Network</label>
                    <select
                        id="networkFilter"
                        value={networkFilter}
                        onChange={(e) => setNetworkFilter(e.target.value)}
                        className="input py-2"
                    >
                        <option value="all">All Networks</option>
                        <option value="google">Google Ads Only</option>
                        <option value="kelkoo">Kelkoo (KL)</option>
                        <option value="admedia">Admedia (AM)</option>
                        <option value="maxbounty">MaxBounty (MB)</option>
                    </select>
                </div>
                <div className="flex-1" />
                <div className="flex items-end gap-2">
                    <span className="text-xs text-muted-foreground">
                        KL: {enrichedCampaigns.filter(c => c.isKelkoo).length} |
                        AM: {enrichedCampaigns.filter(c => c.isAdmedia).length} |
                        MB: {enrichedCampaigns.filter(c => c.isMaxBounty).length}
                    </span>
                </div>
            </div>

            {/* Campaign Comparison Selector */}
            <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">Select Campaigns for Comparison</h3>
                    {selectedCampaignIds.length > 0 && (
                        <button 
                            onClick={clearCampaignSelection}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Clear Selection ({selectedCampaignIds.length})
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {filteredCampaigns.slice(0, 20).map((camp) => (
                        <button
                            key={camp.id}
                            onClick={() => toggleCampaignSelection(camp.id)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                                selectedCampaignIds.includes(camp.id)
                                    ? "bg-primary-500 text-white border-primary-500"
                                    : "bg-card border-border hover:border-primary-500/50"
                            }`}
                        >
                            {camp.name.length > 30 ? camp.name.substring(0, 30) + "..." : camp.name}
                            {camp.isKelkoo && <span className="ml-1 text-purple-300">KL</span>}
                            {camp.isAdmedia && <span className="ml-1 text-amber-300">AM</span>}
                            {camp.isMaxBounty && <span className="ml-1 text-rose-300">MB</span>}
                        </button>
                    ))}
                    {filteredCampaigns.length > 20 && (
                        <span className="px-3 py-1.5 text-xs text-muted-foreground">
                            +{filteredCampaigns.length - 20} more campaigns
                        </span>
                    )}
                </div>
                {selectedCampaignIds.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Click campaigns to compare them. Shows top 4 by cost if none selected.
                    </p>
                )}
            </div>

            {/* Performance Trend Chart */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold">
                        {selectedCampaignIds.length > 0 
                            ? `Comparing ${selectedCampaignIds.length} Selected Campaign${selectedCampaignIds.length > 1 ? 's' : ''}`
                            : `Top ${topCampaigns.length} Campaigns by Cost`}
                    </h2>
                    {selectedCampaignIds.length > 0 && (
                        <span className="text-xs text-muted-foreground">Impressions over last 7 days</span>
                    )}
                </div>
                {isLoading ? (
                    <ChartSkeleton height={300} />
                ) : topCampaigns.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                        No campaigns to display. Try adjusting your filters.
                    </div>
                ) : (
                    <MetricsLineChart
                        data={trendData}
                        metrics={topCampaigns.map((camp, i) => ({
                            key: camp.name,
                            name: camp.name.length > 25 ? camp.name.substring(0, 25) + "..." : camp.name,
                            color: ["#8b5cf6", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"][i % 6],
                        }))}
                        height={300}
                    />
                )}
            </div>

            {/* Campaigns Table */}
            <DataTable
                data={filteredCampaigns}
                columns={columns}
                title={`Campaigns (${filteredCampaigns.length})`}
                searchKeys={["name", "type", "account"]}
                pageSize={15}
            />

            {/* Campaign Detail Modal */}
            {selectedCampaign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedCampaign(null)} />
                    <div className="relative bg-card rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                        <button
                            onClick={() => setSelectedCampaign(null)}
                            className="absolute top-4 right-4 btn-ghost p-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-xl font-display font-bold mb-2">{selectedCampaign.name}</h2>
                        <p className="text-sm text-muted-foreground mb-4">Account: {selectedCampaign.account} | {selectedCampaign.bidStrategy}</p>
                        
                        {/* Network Badge */}
                        <div className="flex gap-2 mb-4">
                            {selectedCampaign.isKelkoo && <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg">Kelkoo Partner</span>}
                            {selectedCampaign.isAdmedia && <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-lg">Admedia Partner</span>}
                            {selectedCampaign.isMaxBounty && <span className="px-2 py-1 bg-rose-500/20 text-rose-400 text-xs rounded-lg">MaxBounty Partner</span>}
                            {!selectedCampaign.isKelkoo && !selectedCampaign.isAdmedia && !selectedCampaign.isMaxBounty && 
                                <span className="px-2 py-1 bg-gray-500/20 text-gray-400 text-xs rounded-lg">Google Ads Only</span>
                            }
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="p-4 bg-muted rounded-xl">
                                <p className="text-xs text-muted-foreground">Impressions</p>
                                <p className="text-xl font-bold">{selectedCampaign.impressions.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-xl">
                                <p className="text-xs text-muted-foreground">Clicks</p>
                                <p className="text-xl font-bold">{selectedCampaign.clicks.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-muted rounded-xl">
                                <p className="text-xs text-muted-foreground">Cost</p>
                                <p className="text-xl font-bold">₹{safeToFixed(selectedCampaign.cost / 1000, 1)}K</p>
                            </div>
                            <div className="p-4 bg-muted rounded-xl">
                                <p className="text-xs text-muted-foreground">ROAS</p>
                                <p className={`text-xl font-bold ${selectedCampaign.roas >= 1 ? "text-success-500" : "text-warning-500"}`}>
                                    {selectedCampaign.roas > 0 ? `${safeToFixed(selectedCampaign.roas, 2)}x` : "-"}
                                </p>
                            </div>
                        </div>

                        {/* Partner Revenue if applicable */}
                        {selectedCampaign.partnerRevenue && selectedCampaign.partnerRevenue > 0 && (
                            <div className="p-4 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-xl border border-purple-500/20 mb-6">
                                <p className="text-xs text-muted-foreground">Partner Revenue</p>
                                <p className="text-2xl font-bold text-cyan-400">₹{selectedCampaign.partnerRevenue.toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Profit/Loss: <span className={selectedCampaign.partnerRevenue - selectedCampaign.cost >= 0 ? "text-emerald-400" : "text-red-400"}>
                                        ₹{(selectedCampaign.partnerRevenue - selectedCampaign.cost).toLocaleString()}
                                    </span>
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">Status</span>
                                <span className={selectedCampaign.status === "Enabled" ? "text-success-500" : "text-muted-foreground"}>
                                    {selectedCampaign.status}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">CTR</span>
                                <span>{safeToFixed(selectedCampaign.ctr, 2)}%</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">Avg CPC</span>
                                <span>₹{safeToFixed(selectedCampaign.avgCpc, 2)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">Conversions</span>
                                <span>{selectedCampaign.conversions}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">Conv. Rate</span>
                                <span>{safeToFixed(selectedCampaign.conversionRate, 2)}%</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-border">
                                <span className="text-muted-foreground">CPA</span>
                                <span>₹{safeToFixed(selectedCampaign.cpa, 2)}</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-muted-foreground">Health Score</span>
                                <span className="text-purple-400">{safeToFixed(selectedCampaign.healthScore, 0)} ({selectedCampaign.efficiencyRating || "-"})</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
