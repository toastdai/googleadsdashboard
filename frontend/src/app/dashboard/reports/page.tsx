"use client";

import { useState, useEffect, useRef } from "react";
import { MetricsLineChart, MetricsAreaChart, MetricsBarChart, MetricsPieChart, ChartSkeleton } from "@/components/charts";
import html2canvas from "html2canvas";

// Available metrics for graph builder
const allMetrics = [
    { key: "impressions", name: "Impressions", color: "#8b5cf6" },
    { key: "clicks", name: "Clicks", color: "#06b6d4" },
    { key: "cost", name: "Cost", color: "#f59e0b" },
    { key: "conversions", name: "Conversions", color: "#22c55e" },
    { key: "ctr", name: "CTR (%)", color: "#ec4899" },
    { key: "cpc", name: "CPC", color: "#f97316" },
    { key: "cpa", name: "CPA", color: "#ef4444" },
    { key: "roas", name: "ROAS", color: "#14b8a6" },
    { key: "conversion_value", name: "Conv. Value", color: "#6366f1" },
];

const chartTypes = [
    { id: "line", name: "Line Chart", icon: "📈" },
    { id: "area", name: "Area Chart", icon: "📊" },
    { id: "bar", name: "Bar Chart", icon: "📉" },
    { id: "pie", name: "Pie Chart", icon: "🥧" },
];

const datePresets = [
    { id: "7d", name: "Last 7 days", days: 7 },
    { id: "14d", name: "Last 14 days", days: 14 },
    { id: "30d", name: "Last 30 days", days: 30 },
    { id: "90d", name: "Last 90 days", days: 90 },
];

// Generate mock data
function generateData(days: number, metrics: string[]) {
    const data = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const row: any = { date: date.toISOString().split("T")[0] };

        const baseImpressions = 150000 + Math.random() * 50000;
        row.impressions = Math.round(baseImpressions);
        row.clicks = Math.round(baseImpressions * (0.03 + Math.random() * 0.02));
        row.cost = Math.round(baseImpressions * 0.12 + Math.random() * 5000);
        row.conversions = Math.round(row.clicks * (0.02 + Math.random() * 0.03));
        row.ctr = parseFloat((row.clicks / row.impressions * 100).toFixed(2));
        row.cpc = parseFloat((row.cost / row.clicks).toFixed(2));
        row.cpa = row.conversions > 0 ? parseFloat((row.cost / row.conversions).toFixed(2)) : 0;
        row.roas = parseFloat((3 + Math.random() * 3).toFixed(2));
        row.conversion_value = Math.round(row.conversions * (500 + Math.random() * 300));

        data.push(row);
    }
    return data;
}

export default function ReportsPage() {
    const [selectedMetrics, setSelectedMetrics] = useState(["impressions", "clicks"]);
    const [chartType, setChartType] = useState("line");
    const [dateRange, setDateRange] = useState("7d");
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const chartRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(true);
        const days = datePresets.find((p) => p.id === dateRange)?.days || 7;
        setTimeout(() => {
            setData(generateData(days, selectedMetrics));
            setIsLoading(false);
        }, 300);
    }, [dateRange, selectedMetrics]);

    const toggleMetric = (metricKey: string) => {
        setSelectedMetrics((prev) => {
            if (prev.includes(metricKey)) {
                return prev.length > 1 ? prev.filter((m) => m !== metricKey) : prev;
            }
            return [...prev, metricKey];
        });
    };

    const exportPNG = async () => {
        if (!chartRef.current) return;
        const canvas = await html2canvas(chartRef.current, { backgroundColor: "#0b1120" });
        const url = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `chart-${new Date().toISOString().split("T")[0]}.png`;
        a.click();
    };

    const exportCSV = () => {
        const headers = ["date", ...selectedMetrics].join(",");
        const rows = data.map((row) =>
            ["date", ...selectedMetrics].map((key) => row[key]).join(",")
        );
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `data-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Prepare pie chart data
    const pieData = selectedMetrics.slice(0, 4).map((key) => ({
        name: allMetrics.find((m) => m.key === key)?.name || key,
        value: data.reduce((sum, row) => sum + (row[key] || 0), 0),
    }));

    const activeMetrics = allMetrics.filter((m) => selectedMetrics.includes(m.key));

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold">Custom Reports</h1>
                    <p className="text-muted-foreground mt-1">
                        Build custom graphs and export your data
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={exportPNG} className="btn-secondary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Export PNG
                    </button>
                    <button onClick={exportCSV} className="btn-primary">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Configuration Panel */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
                {/* Chart Type */}
                <div>
                    <label className="block text-sm font-medium mb-3">Chart Type</label>
                    <div className="flex flex-wrap gap-2">
                        {chartTypes.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${chartType === type.id
                                        ? "bg-primary-500 text-white"
                                        : "bg-muted hover:bg-muted/80"
                                    }`}
                            >
                                {type.icon} {type.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Date Range */}
                <div>
                    <label className="block text-sm font-medium mb-3">Date Range</label>
                    <div className="flex flex-wrap gap-2">
                        {datePresets.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => setDateRange(preset.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${dateRange === preset.id
                                        ? "bg-primary-500 text-white"
                                        : "bg-muted hover:bg-muted/80"
                                    }`}
                            >
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Metrics */}
                <div>
                    <label className="block text-sm font-medium mb-3">Metrics</label>
                    <div className="flex flex-wrap gap-2">
                        {allMetrics.map((metric) => (
                            <button
                                key={metric.key}
                                onClick={() => toggleMetric(metric.key)}
                                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors border-2 ${selectedMetrics.includes(metric.key)
                                        ? "border-transparent text-white"
                                        : "border-transparent bg-muted hover:bg-muted/80"
                                    }`}
                                style={{
                                    backgroundColor: selectedMetrics.includes(metric.key) ? metric.color : undefined,
                                }}
                            >
                                {metric.name}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div ref={chartRef} className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-semibold mb-4">
                    {activeMetrics.map((m) => m.name).join(" vs ")}
                </h2>
                {isLoading ? (
                    <ChartSkeleton height={400} />
                ) : chartType === "line" ? (
                    <MetricsLineChart data={data} metrics={activeMetrics} height={400} />
                ) : chartType === "area" ? (
                    <MetricsAreaChart data={data} metrics={activeMetrics} height={400} />
                ) : chartType === "bar" ? (
                    <MetricsBarChart
                        data={data.map((d) => ({ ...d, name: d.date }))}
                        metrics={activeMetrics}
                        height={400}
                    />
                ) : (
                    <MetricsPieChart data={pieData} height={400} />
                )}
            </div>

            {/* Raw Data Table */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-display font-semibold">Raw Data</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                {activeMetrics.map((m) => (
                                    <th key={m.key} className="text-right">{m.name}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.slice(0, 10).map((row, i) => (
                                <tr key={i}>
                                    <td>{row.date}</td>
                                    {activeMetrics.map((m) => (
                                        <td key={m.key} className="text-right tabular-nums">
                                            {typeof row[m.key] === "number" ? row[m.key].toLocaleString() : row[m.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
