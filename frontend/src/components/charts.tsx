"use client";

import { useMemo } from "react";
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    ReferenceLine,
} from "recharts";

// Safe toFixed wrapper to prevent errors on null/undefined/non-numeric values
const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return "0";
    return num.toFixed(decimals);
};

// Color palette for charts - explicit hex values for dark mode compatibility
const COLORS = {
    primary: "#8b5cf6",
    secondary: "#06b6d4",
    success: "#22c55e",
    warning: "#f59e0b",
    danger: "#ef4444",
    muted: "#94a3b8",
    text: "#e2e8f0", // Light gray for dark mode
    grid: "#334155", // Subtle grid lines for dark mode
    border: "#475569",
};

const CHART_COLORS = [
    "#8b5cf6",
    "#06b6d4",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
];

// Custom tooltip style
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl backdrop-blur-sm">
                <p className="text-sm font-medium mb-2 text-white">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm" style={{ color: entry.color }}>
                        {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Format axis values
const formatAxisValue = (value: number, format: string = "number"): string => {
    if (format === "currency") {
        if (value >= 100000) return `₹${safeToFixed(value / 100000, 1)}L`;
        if (value >= 1000) return `₹${safeToFixed(value / 1000, 1)}K`;
        return `₹${safeToFixed(value, 0)}`;
    }
    if (format === "percent") {
        return `${safeToFixed(value, 1)}%`;
    }
    if (value >= 1000000) return `${safeToFixed(value / 1000000, 1)}M`;
    if (value >= 1000) return `${safeToFixed(value / 1000, 1)}K`;
    return value.toLocaleString();
};

// Line Chart Component
interface LineChartData {
    date: string;
    [key: string]: number | string;
}

interface MetricsLineChartProps {
    data: LineChartData[];
    metrics: { key: string; name: string; color?: string }[];
    height?: number;
    format?: "number" | "currency" | "percent";
    showGrid?: boolean;
    showLegend?: boolean;
}

export function MetricsLineChart({
    data,
    metrics,
    height = 300,
    format = "number",
    showGrid = true,
    showLegend = true,
}: MetricsLineChartProps) {
    const formattedData = useMemo(() => {
        return data.map((d) => ({
            ...d,
            // Use date directly if it looks like a label (contains letters), otherwise format it
            dateLabel: d.date ? (d.date.match(/[a-zA-Z]/) ? d.date : `Day ${d.date}`) : "",
        }));
    }, [data]);

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.5} />}
                    <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: COLORS.text, fontSize: 12 }}
                        axisLine={{ stroke: COLORS.border }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: COLORS.text, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatAxisValue(v, format)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {showLegend && <Legend wrapperStyle={{ color: COLORS.text }} />}
                    {metrics.map((metric, index) => (
                        <Line
                            key={metric.key}
                            type="monotone"
                            dataKey={metric.key}
                            name={metric.name}
                            stroke={metric.color || CHART_COLORS[index % CHART_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 2 }}
                        />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// Area Chart Component
export function MetricsAreaChart({
    data,
    metrics,
    height = 300,
    format = "number",
    stacked = false,
    showAverage = false,
}: MetricsLineChartProps & { stacked?: boolean; showAverage?: boolean }) {
    const formattedData = useMemo(() => {
        return data.map((d) => ({
            ...d,
            // Use date directly if it looks like a label (contains letters), otherwise format it
            dateLabel: d.date ? (d.date.match(/[a-zA-Z]/) ? d.date : `Day ${d.date}`) : "",
        }));
    }, [data]);

    // Calculate average for reference line
    const average = useMemo(() => {
        if (!showAverage || !metrics[0]) return 0;
        const key = metrics[0].key;
        const values = data.map(d => Number(d[key]) || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    }, [data, metrics, showAverage]);

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                        {metrics.map((metric, index) => (
                            <linearGradient key={metric.key} id={`gradient-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={metric.color || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.4} />
                                <stop offset="100%" stopColor={metric.color || CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.05} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.5} />
                    <XAxis
                        dataKey="dateLabel"
                        tick={{ fill: COLORS.text, fontSize: 12 }}
                        axisLine={{ stroke: COLORS.border }}
                        tickLine={false}
                    />
                    <YAxis
                        tick={{ fill: COLORS.text, fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatAxisValue(v, format)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: COLORS.text }} />
                    {showAverage && average > 0 && (
                        <ReferenceLine y={average} stroke={COLORS.warning} strokeDasharray="5 5" label={{ value: "Avg", fill: COLORS.warning, fontSize: 11 }} />
                    )}
                    {metrics.map((metric, index) => (
                        <Area
                            key={metric.key}
                            type="monotone"
                            dataKey={metric.key}
                            name={metric.name}
                            stroke={metric.color || CHART_COLORS[index % CHART_COLORS.length]}
                            fill={`url(#gradient-${metric.key})`}
                            strokeWidth={2}
                            stackId={stacked ? "stack" : undefined}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Bar Chart Component
interface BarChartData {
    name: string;
    [key: string]: number | string;
}

interface MetricsBarChartProps {
    data: BarChartData[];
    metrics: { key: string; name: string; color?: string }[];
    height?: number;
    format?: "number" | "currency" | "percent";
    horizontal?: boolean;
}

export function MetricsBarChart({
    data,
    metrics,
    height = 300,
    format = "number",
    horizontal = false,
}: MetricsBarChartProps) {
    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout={horizontal ? "vertical" : "horizontal"}
                    margin={{ top: 5, right: 20, left: horizontal ? 80 : 10, bottom: horizontal ? 5 : 60 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} opacity={0.5} />
                    {horizontal ? (
                        <>
                            <XAxis
                                type="number"
                                tick={{ fill: COLORS.text, fontSize: 12 }}
                                axisLine={{ stroke: COLORS.border }}
                                tickFormatter={(v) => formatAxisValue(v, format)}
                            />
                            <YAxis
                                type="category"
                                dataKey="name"
                                tick={{ fill: COLORS.text, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={70}
                            />
                        </>
                    ) : (
                        <>
                            <XAxis
                                dataKey="name"
                                tick={({ x, y, payload }) => (
                                    <g transform={`translate(${x},${y})`}>
                                        <text
                                            x={0}
                                            y={0}
                                            dy={10}
                                            textAnchor="end"
                                            fill={COLORS.text}
                                            fontSize={10}
                                            transform="rotate(-40)"
                                        >
                                            {payload.value}
                                        </text>
                                    </g>
                                )}
                                axisLine={{ stroke: COLORS.border }}
                                tickLine={false}
                                interval={0}
                                height={80}
                            />
                            <YAxis
                                tick={{ fill: COLORS.text, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => formatAxisValue(v, format)}
                            />
                        </>
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: COLORS.text }} />
                    {metrics.map((metric, index) => (
                        <Bar
                            key={metric.key}
                            dataKey={metric.key}
                            name={metric.name}
                            fill={metric.color || CHART_COLORS[index % CHART_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Pie Chart Component
interface PieChartData {
    name: string;
    value: number;
    [key: string]: string | number;
}

interface MetricsPieChartProps {
    data: PieChartData[];
    height?: number;
    showLabels?: boolean;
    innerRadius?: number;
}

export function MetricsPieChart({
    data,
    height = 300,
    showLabels = true,
    innerRadius = 0,
}: MetricsPieChartProps) {
    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius="80%"
                        paddingAngle={2}
                        dataKey="value"
                        label={showLabels ? ({ name, percent }) => `${name}: ${safeToFixed((percent || 0) * 100, 0)}%` : false}
                        labelLine={showLabels}
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${entry.name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ color: COLORS.text }} />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// Gauge Chart Component
interface GaugeChartProps {
    value: number;
    max: number;
    label: string;
    color?: string;
    size?: number;
}

export function GaugeChart({ value, max, label, color = COLORS.primary, size = 120 }: GaugeChartProps) {
    const percentage = Math.min((value / max) * 100, 100);
    const rotation = (percentage / 100) * 180 - 90;

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: size, height: size / 2 }}>
                <svg viewBox="0 0 100 50" className="w-full h-full">
                    {/* Background arc */}
                    <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke="#334155"
                        strokeWidth="8"
                        strokeLinecap="round"
                    />
                    {/* Value arc */}
                    <path
                        d="M 10 50 A 40 40 0 0 1 90 50"
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${percentage * 1.26} 126`}
                        className="transition-all duration-500"
                    />
                </svg>
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                    <span className="text-lg font-bold" style={{ color }}>{safeToFixed(percentage, 0)}%</span>
                </div>
            </div>
            <span className="text-xs text-muted-foreground mt-1">{label}</span>
        </div>
    );
}

// Sparkline mini chart
interface SparklineProps {
    data: number[];
    color?: string;
    height?: number;
    width?: number;
}

export function Sparkline({ data, color = COLORS.primary, height = 40, width = 100 }: SparklineProps) {
    const chartData = data.map((value, index) => ({ index, value }));

    return (
        <div style={{ width, height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`spark-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={`url(#spark-gradient-${color})`}
                        strokeWidth={1.5}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Chart Loading Skeleton
export function ChartSkeleton({ height = 300 }: { height?: number }) {
    return (
        <div className="w-full animate-pulse" style={{ height }}>
            <div className="h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">Loading chart...</span>
            </div>
        </div>
    );
}

// Progress Bar Component
interface ProgressBarProps {
    value: number;
    max: number;
    label?: string;
    showValue?: boolean;
    color?: "primary" | "success" | "warning" | "danger";
    size?: "sm" | "md" | "lg";
}

export function ProgressBar({ value, max, label, showValue = true, color = "primary", size = "md" }: ProgressBarProps) {
    const percentage = Math.min((value / max) * 100, 100);
    const heights = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
    const colors = {
        primary: "bg-primary-500",
        success: "bg-success-500",
        warning: "bg-warning-500",
        danger: "bg-danger-500",
    };

    return (
        <div className="w-full">
            {(label || showValue) && (
                <div className="flex justify-between text-xs mb-1">
                    {label && <span className="text-muted-foreground">{label}</span>}
                    {showValue && <span className="font-medium">{safeToFixed(percentage, 0)}%</span>}
                </div>
            )}
            <div className={`w-full bg-gray-700 rounded-full ${heights[size]} overflow-hidden`}>
                <div
                    className={`${colors[color]} ${heights[size]} rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
}
