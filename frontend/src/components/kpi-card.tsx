import { MetricValue } from "@/lib/api";

interface KPICardProps {
    title: string;
    value: string | number;
    metric: MetricValue;
    format?: "number" | "currency" | "percent";
    currencySymbol?: string;
    icon?: React.ReactNode;
    color?: "default" | "success" | "warning" | "danger";
}

const ArrowUpIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
);

const ArrowDownIcon = () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
);

export function KPICard({
    title,
    value,
    metric,
    format = "number",
    currencySymbol = "Rs.",
    icon,
    color = "default",
}: KPICardProps) {
    const formatValue = (val: number | string): string => {
        if (typeof val === "string") return val;

        switch (format) {
            case "currency":
                if (val >= 100000) {
                    return `${currencySymbol}${(val / 100000).toFixed(2)}L`;
                } else if (val >= 1000) {
                    return `${currencySymbol}${(val / 1000).toFixed(2)}K`;
                }
                return `${currencySymbol}${val.toFixed(2)}`;
            case "percent":
                return `${val.toFixed(2)}%`;
            default:
                if (val >= 1000000) {
                    return `${(val / 1000000).toFixed(2)}M`;
                } else if (val >= 1000) {
                    return `${(val / 1000).toFixed(2)}K`;
                }
                return val.toLocaleString();
        }
    };

    const getChangeColor = () => {
        if (!metric.change_direction || metric.change_direction === "flat") {
            return "text-muted-foreground";
        }

        // For cost/CPA, down is good; for others, up is good
        const isPositiveChange = metric.change_direction === "up";
        const isGoodMetric = !["cost", "cpa", "cpc"].includes(title.toLowerCase());

        if ((isPositiveChange && isGoodMetric) || (!isPositiveChange && !isGoodMetric)) {
            return "text-success-500";
        }
        return "text-danger-500";
    };

    const getBadgeClass = () => {
        const changeColor = getChangeColor();
        if (changeColor === "text-success-500") return "badge-success";
        if (changeColor === "text-danger-500") return "badge-danger";
        return "bg-muted text-muted-foreground";
    };

    const colorClasses = {
        default: "from-primary-500/10 to-transparent",
        success: "from-success-500/10 to-transparent",
        warning: "from-warning-500/10 to-transparent",
        danger: "from-danger-500/10 to-transparent",
    };

    return (
        <div className="kpi-card group">
            {/* Background gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color]} opacity-50 rounded-2xl`} />

            {/* Content */}
            <div className="relative">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-muted-foreground">{title}</span>
                    {icon && (
                        <div className="p-2 rounded-lg bg-muted/50 text-muted-foreground group-hover:text-primary-500 transition-colors">
                            {icon}
                        </div>
                    )}
                </div>

                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-2xl font-display font-bold">
                            {formatValue(value)}
                        </p>

                        {metric.change_percent !== undefined && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className={`${getBadgeClass()} inline-flex items-center gap-1`}>
                                    {metric.change_direction === "up" ? <ArrowUpIcon /> : <ArrowDownIcon />}
                                    {Math.abs(metric.change_percent).toFixed(1)}%
                                </span>
                                <span className="text-xs text-muted-foreground">vs prev period</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Skeleton loader for KPI card
export function KPICardSkeleton() {
    return (
        <div className="kpi-card">
            <div className="flex items-center justify-between mb-4">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-8 w-8 rounded-lg" />
            </div>
            <div className="skeleton h-8 w-32 mb-2" />
            <div className="skeleton h-4 w-20" />
        </div>
    );
}
