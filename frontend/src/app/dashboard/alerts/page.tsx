"use client";

import { useState, useMemo } from "react";
import { useAlerts } from "@/lib/hooks";
import { Alert } from "@/lib/api";
import { DataTable } from "@/components/data-table";

const AlertIcon = ({ severity }: { severity: string }) => {
    if (severity === "CRITICAL") {
        return (
            <div className="w-10 h-10 rounded-xl bg-danger-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
        );
    }
    if (severity === "WARNING") {
        return (
            <div className="w-10 h-10 rounded-xl bg-warning-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-warning-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
        );
    }
    return (
        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
    );
};

const SeverityBadge = ({ severity }: { severity: string }) => {
    const classes = {
        CRITICAL: "badge-danger",
        WARNING: "badge-warning",
        INFO: "bg-primary-500/20 text-primary-500",
    };
    return (
        <span className={`${classes[severity as keyof typeof classes] || classes.INFO} px-2 py-0.5 rounded-full text-xs font-medium`}>
            {severity}
        </span>
    );
};

function formatTimeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function AlertsPage() {
    const [filter, setFilter] = useState<"all" | "unread" | "CRITICAL" | "WARNING" | "INFO">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

    // Use API hook
    const { data: alerts, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useAlerts();

    const filteredAlerts = useMemo(() => {
        return alerts.filter((alert) => {
            if (filter === "unread" && alert.is_read) return false;
            if (filter !== "all" && filter !== "unread" && alert.severity !== filter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return (
                    alert.message.toLowerCase().includes(query) ||
                    alert.campaign_name?.toLowerCase().includes(query) ||
                    alert.metric.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [alerts, filter, searchQuery]);

    // Table columns for table view
    const tableColumns = [
        {
            key: "severity",
            header: "Severity",
            render: (value: string) => <SeverityBadge severity={value} />,
        },
        { key: "metric", header: "Metric", render: (value: string) => value.toUpperCase() },
        { key: "campaign_name", header: "Campaign" },
        { key: "message", header: "Message" },
        {
            key: "detected_at",
            header: "Time",
            render: (value: string) => formatTimeAgo(value),
        },
        {
            key: "is_read",
            header: "Status",
            render: (value: boolean) => (
                <span className={value ? "text-muted-foreground" : "text-primary-500 font-medium"}>
                    {value ? "Read" : "Unread"}
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-display font-bold">Alerts</h1>
                        {unreadCount > 0 && (
                            <span className="badge-danger">{unreadCount} unread</span>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Spike and anomaly alerts from your campaigns
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => refetch()} className="btn-ghost px-3 py-2">
                        <svg className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    {/* View mode toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setViewMode("cards")}
                            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "cards" ? "bg-card shadow-sm" : "hover:bg-muted/80"
                                }`}
                        >
                            Cards
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "table" ? "bg-card shadow-sm" : "hover:bg-muted/80"
                                }`}
                        >
                            Table
                        </button>
                    </div>
                    {unreadCount > 0 && (
                        <button onClick={markAllAsRead} className="btn-secondary">
                            Mark all read
                        </button>
                    )}
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: "All", value: "all" },
                        { label: "Unread", value: "unread" },
                        { label: "Critical", value: "CRITICAL" },
                        { label: "Warning", value: "WARNING" },
                        { label: "Info", value: "INFO" },
                    ].map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setFilter(f.value as typeof filter)}
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f.value
                                    ? "bg-primary-500 text-white"
                                    : "bg-muted hover:bg-muted/80"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1">
                    <input
                        type="text"
                        placeholder="Search alerts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input"
                    />
                </div>
            </div>

            {/* Alerts */}
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="glass-card p-4 animate-pulse">
                            <div className="flex items-start gap-4">
                                <div className="skeleton w-10 h-10 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-48" />
                                    <div className="skeleton h-5 w-full" />
                                    <div className="skeleton h-3 w-24" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredAlerts.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No alerts found</h3>
                    <p className="text-muted-foreground">
                        {filter === "all" && !searchQuery
                            ? "Great! No anomalies detected in your campaigns."
                            : "No matching alerts found."}
                    </p>
                </div>
            ) : viewMode === "table" ? (
                <DataTable
                    data={filteredAlerts}
                    columns={tableColumns}
                    title={`Alerts (${filteredAlerts.length})`}
                    searchable={false}
                    pageSize={10}
                />
            ) : (
                <div className="space-y-3">
                    {filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`glass-card p-4 transition-all ${!alert.is_read
                                    ? "border-l-4 border-primary-500 bg-primary-500/5"
                                    : ""
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <AlertIcon severity={alert.severity} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <SeverityBadge severity={alert.severity} />
                                        <span className="text-sm text-muted-foreground">
                                            {alert.metric.toUpperCase()}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            {formatTimeAgo(alert.detected_at)}
                                        </span>
                                    </div>
                                    <p className="font-medium">{alert.message}</p>
                                    {alert.campaign_name && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Campaign: {alert.campaign_name}
                                        </p>
                                    )}
                                    {alert.context && (
                                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                            <span>Z-Score: {(alert.context as any).z_score?.toFixed(2)}</span>
                                            <span>Change: {(alert.context as any).percent_change?.toFixed(1)}%</span>
                                        </div>
                                    )}
                                </div>
                                {!alert.is_read && (
                                    <button
                                        onClick={() => markAsRead(alert.id)}
                                        className="btn-ghost text-sm flex-shrink-0"
                                    >
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
