"use client";

import { useState, useMemo, useEffect } from "react";
import { useAlerts } from "@/lib/hooks";
import { Alert, api, AlertConfig as ApiAlertConfig } from "@/lib/api";
import { DataTable } from "@/components/data-table";

interface AlertConfig extends ApiAlertConfig {
    // Local extension if needed
}

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

// Telegram Integration Panel Component
function TelegramPanel({ config, onCheckSpikes, isChecking, onPauseToggle, isPausing }: {
    config: AlertConfig | null;
    onCheckSpikes: () => void;
    isChecking: boolean;
    onPauseToggle: () => void;
    isPausing: boolean;
}) {
    const [showSetup, setShowSetup] = useState(false);

    return (
        <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold">Telegram Alerts</h3>
                        <p className="text-sm text-muted-foreground">
                            Real-time spike notifications to your phone
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {config?.alerts_paused && (
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning-500/20 text-warning-500 text-sm font-medium">
                            PAUSED
                        </span>
                    )}
                    {config?.telegram_configured ? (
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-500/20 text-success-500 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
                            Connected
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground"></span>
                            Not Connected
                        </span>
                    )}
                </div>
            </div>

            {/* Collapsible status grid */}
            <div className="mb-4">
                <button
                    onClick={() => setShowSetup(prev => !prev)}
                    className="btn-ghost mb-2 flex items-center gap-2"
                >
                    {showSetup ? 'Hide Status' : 'Show Status'}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showSetup ? "M6 18L18 6M6 6l12 12" : "M9 5l7 7-7 7"} />
                    </svg>
                </button>
                {showSetup && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-muted/50 rounded-xl p-3">
                            <div className="text-xs text-muted-foreground mb-1">Scheduler</div>
                            <div className={`text-sm font-semibold ${config?.scheduler_running ? 'text-success-500' : 'text-danger-500'}`}>
                                {config?.scheduler_running ? 'Running' : 'Stopped'}
                            </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                            <div className="text-xs text-muted-foreground mb-1">Check Interval</div>
                            <div className="text-sm font-semibold">
                                Every {config?.scheduler_interval_minutes || 60} min
                            </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                            <div className="text-xs text-muted-foreground mb-1">Threshold</div>
                            <div className="text-sm font-semibold">
                                {config?.spike_threshold_percent || 20} % change
                            </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                            <div className="text-xs text-muted-foreground mb-1">Next Check</div>
                            <div className="text-sm font-semibold">
                                {config?.next_check ? new Date(config.next_check).toLocaleTimeString() : 'N/A'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={onCheckSpikes}
                    disabled={isChecking}
                    className="btn-primary flex items-center gap-2"
                >
                    {isChecking ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    )}
                    {isChecking ? 'Checking...' : 'Check Now'}
                </button>

                <button
                    onClick={onPauseToggle}
                    disabled={isPausing}
                    className={`flex items-center gap-2 ${config?.alerts_paused ? 'btn-primary' : 'btn-secondary'}`}
                >
                    {isPausing ? (
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : config?.alerts_paused ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    )}
                    {isPausing ? 'Updating...' : config?.alerts_paused ? 'Resume Alerts' : 'Pause Alerts'}
                </button>

                <a
                    href="https://t.me/tellspike_alerts_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center gap-2"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    Open Telegram Bot
                </a>

                <button
                    onClick={() => setShowSetup(!showSetup)}
                    className="btn-ghost flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826 3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {showSetup ? 'Hide Setup' : 'Setup Guide'}
                </button>
            </div>

            {/* Setup Instructions */}
            {showSetup && (
                <div className="mt-4 p-4 bg-muted/30 rounded-xl border border-border">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Available Bot Commands
                    </h4>
                    <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-muted rounded text-primary-500">/start</code>
                            <span className="text-muted-foreground">- Initialize and get welcome message</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-muted rounded text-primary-500">/status</code>
                            <span className="text-muted-foreground">- Check alert system status</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-muted rounded text-primary-500">/check</code>
                            <span className="text-muted-foreground">- Manually trigger spike check</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-muted rounded text-primary-500">/config</code>
                            <span className="text-muted-foreground">- View current configuration</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className="px-2 py-0.5 bg-muted rounded text-primary-500">/help</code>
                            <span className="text-muted-foreground">- Show all available commands</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AlertsPage() {
    const [filter, setFilter] = useState<"all" | "unread" | "CRITICAL" | "WARNING" | "INFO">("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [checkResult, setCheckResult] = useState<string | null>(null);

    // Use API hook
    const { data: alerts, unreadCount, isLoading, markAsRead, markAllAsRead, refetch } = useAlerts();

    // Fetch alert config
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const data = await api.getAlertConfig();
                setAlertConfig(data as AlertConfig);
            } catch (error) {
                console.error('Failed to fetch alert config:', error);
            }
        };
        fetchConfig();

        // Refresh every 30 seconds
        const interval = setInterval(fetchConfig, 30000);
        return () => clearInterval(interval);
    }, []);

    // Handle manual spike check
    const handleCheckSpikes = async () => {
        setIsChecking(true);
        setCheckResult(null);
        try {
            const data = await api.triggerSpikeCheck();
            if (data.spikes_detected > 0) {
                setCheckResult(`Found ${data.spikes_detected} spike(s). ${data.alerts_sent} alert(s) sent to Telegram.`);
            } else {
                setCheckResult('No spikes detected. All metrics within normal range.');
            }
        } catch (error) {
            setCheckResult('Failed to check spikes. Backend may be starting up.');
        } finally {
            setIsChecking(false);
        }
    };

    // Handle pause/resume toggle
    const handlePauseToggle = async () => {
        setIsPausing(true);
        try {
            if (alertConfig?.alerts_paused) {
                await api.resumeAlerts();
            } else {
                await api.pauseAlerts();
            }
            // Refresh config to get updated state
            const data = await api.getAlertConfig();
            setAlertConfig(data as AlertConfig);
        } catch (error) {
            console.error('Failed to toggle pause state:', error);
        } finally {
            setIsPausing(false);
        }
    };

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
            {/* Telegram Integration Panel */}
            <TelegramPanel
                config={alertConfig}
                onCheckSpikes={handleCheckSpikes}
                isChecking={isChecking}
                onPauseToggle={handlePauseToggle}
                isPausing={isPausing}
            />

            {/* Check Result Toast */}
            {checkResult && (
                <div className="glass-card p-4 border-l-4 border-primary-500 animate-fade-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{checkResult}</span>
                        </div>
                        <button onClick={() => setCheckResult(null)} className="text-muted-foreground hover:text-foreground">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-display font-bold">Alert History</h1>
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

