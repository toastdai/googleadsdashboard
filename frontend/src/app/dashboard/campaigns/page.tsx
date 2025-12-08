"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { MetricsLineChart, MetricsBarChart, ChartSkeleton } from "@/components/charts";

interface Campaign {
    id: string;
    name: string;
    status: string;
    type: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    budget: number;
    spend_rate: number;
}

// Mock campaigns data
const mockCampaigns: Campaign[] = [
    { id: "1", name: "Brand - Search", status: "ENABLED", type: "SEARCH", impressions: 523456, clicks: 18234, cost: 52345.67, conversions: 312, ctr: 3.48, cpc: 2.87, cpa: 167.77, roas: 5.97, budget: 60000, spend_rate: 87 },
    { id: "2", name: "Non-Brand - Performance Max", status: "ENABLED", type: "PERFORMANCE_MAX", impressions: 345678, clicks: 12456, cost: 45678.90, conversions: 245, ctr: 3.60, cpc: 3.67, cpa: 186.44, roas: 5.13, budget: 50000, spend_rate: 91 },
    { id: "3", name: "Shopping - Products", status: "ENABLED", type: "SHOPPING", impressions: 234567, clicks: 9876, cost: 34567.89, conversions: 198, ctr: 4.21, cpc: 3.50, cpa: 174.59, roas: 4.54, budget: 40000, spend_rate: 86 },
    { id: "4", name: "Display - Remarketing", status: "ENABLED", type: "DISPLAY", impressions: 142081, clicks: 4668, cost: 23456.78, conversions: 137, ctr: 3.29, cpc: 5.02, cpa: 171.22, roas: 3.65, budget: 30000, spend_rate: 78 },
    { id: "5", name: "Video - YouTube Brand", status: "PAUSED", type: "VIDEO", impressions: 89234, clicks: 2345, cost: 12345.67, conversions: 45, ctr: 2.63, cpc: 5.27, cpa: 274.35, roas: 2.12, budget: 20000, spend_rate: 62 },
    { id: "6", name: "Display - New Users", status: "ENABLED", type: "DISPLAY", impressions: 234567, clicks: 5678, cost: 18234.56, conversions: 89, ctr: 2.42, cpc: 3.21, cpa: 204.88, roas: 3.24, budget: 25000, spend_rate: 73 },
];

// Generate campaign performance data
function generateCampaignTrendData(days: number = 7) {
    const data = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().split("T")[0],
            "Brand - Search": Math.round(70000 + Math.random() * 20000),
            "Non-Brand - Performance Max": Math.round(45000 + Math.random() * 15000),
            "Shopping - Products": Math.round(30000 + Math.random() * 10000),
            "Display - Remarketing": Math.round(18000 + Math.random() * 8000),
        });
    }
    return data;
}

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [statusFilter, setStatusFilter] = useState<"all" | "ENABLED" | "PAUSED">("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [trendData, setTrendData] = useState<any[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            await new Promise((resolve) => setTimeout(resolve, 500));
            setCampaigns(mockCampaigns);
            setTrendData(generateCampaignTrendData(7));
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const filteredCampaigns = campaigns.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (typeFilter !== "all" && c.type !== typeFilter) return false;
        return true;
    });

    const campaignTypes = [...new Set(campaigns.map((c) => c.type))];

    const columns = [
        {
            key: "name",
            header: "Campaign",
            sortable: true,
            render: (value: string, row: Campaign) => (
                <div>
                    <button
                        className="font-medium hover:text-primary-500 transition-colors text-left"
                        onClick={() => setSelectedCampaign(row)}
                    >
                        {value}
                    </button>
                    <div className="text-xs text-muted-foreground mt-0.5">{row.type}</div>
                </div>
            ),
        },
        {
            key: "status",
            header: "Status",
            render: (value: string) => (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${value === "ENABLED" ? "bg-success-100 text-success-600" : "bg-muted text-muted-foreground"
                    }`}>
                    {value}
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
            render: (value: number) => (
                <span className={`font-medium ${value >= 4 ? "text-success-500" : value >= 2 ? "text-foreground" : "text-warning-500"}`}>
                    {value?.toFixed(2)}x
                </span>
            ),
        },
        {
            key: "spend_rate",
            header: "Budget",
            align: "right" as const,
            render: (value: number, row: Campaign) => (
                <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${value > 90 ? "bg-warning-500" : "bg-primary-500"}`}
                            style={{ width: `${value}%` }}
                        />
                    </div>
                    <span className="text-xs tabular-nums">{value}%</span>
                </div>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold">Campaigns</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage and analyze your Google Ads campaigns
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 p-4 bg-card rounded-xl border border-border">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="input py-2"
                    >
                        <option value="all">All Statuses</option>
                        <option value="ENABLED">Enabled</option>
                        <option value="PAUSED">Paused</option>
                    </select>
                </div>
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Campaign Type</label>
                    <select
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
                <div className="flex-1" />
                <div className="flex items-end">
                    <button className="btn-primary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Sync Data
                    </button>
                </div>
            </div>

            {/* Performance Trend Chart */}
            <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-semibold mb-4">Impressions by Campaign</h2>
                {isLoading ? (
                    <ChartSkeleton height={300} />
                ) : (
                    <MetricsLineChart
                        data={trendData}
                        metrics={[
                            { key: "Brand - Search", name: "Brand - Search", color: "#8b5cf6" },
                            { key: "Non-Brand - Performance Max", name: "Performance Max", color: "#06b6d4" },
                            { key: "Shopping - Products", name: "Shopping", color: "#22c55e" },
                            { key: "Display - Remarketing", name: "Remarketing", color: "#f59e0b" },
                        ]}
                        height={300}
                    />
                )}
            </div>

            {/* Campaigns Table */}
            <DataTable
                data={filteredCampaigns}
                columns={columns}
                title={`Campaigns (${filteredCampaigns.length})`}
                searchKeys={["name", "type"]}
                pageSize={10}
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
                        <h2 className="text-xl font-display font-bold mb-4">{selectedCampaign.name}</h2>
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
                                <p className="text-xl font-bold">Rs.{(selectedCampaign.cost / 1000).toFixed(1)}K</p>
                            </div>
                            <div className="p-4 bg-muted rounded-xl">
                                <p className="text-xs text-muted-foreground">ROAS</p>
                                <p className="text-xl font-bold text-success-500">{selectedCampaign.roas.toFixed(2)}x</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <span className={selectedCampaign.status === "ENABLED" ? "text-success-500" : "text-muted-foreground"}>
                                    {selectedCampaign.status}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span>{selectedCampaign.type}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CTR</span>
                                <span>{selectedCampaign.ctr.toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CPC</span>
                                <span>Rs.{selectedCampaign.cpc.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">CPA</span>
                                <span>Rs.{selectedCampaign.cpa.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
