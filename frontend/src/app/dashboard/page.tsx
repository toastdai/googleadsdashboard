"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    RefreshCw,
    Download,
    Search,
    Palette,
    BarChart3,
    Maximize,
} from "lucide-react";
import {
    campaigns,
    totals,
    accountBreakdown,
    topPerformers,
    bottomPerformers,
    dailyTrend,
    formatCurrency,
    formatNumber,
    Campaign
} from "@/lib/campaign-data";
import {
    MetricsAreaChart,
    MetricsBarChart,
    MetricsPieChart,
    GaugeChart,
    ProgressBar,
} from "@/components/charts";
import { DataTable } from "@/components/data-table";

// Keyboard shortcut hook
function useKeyboardShortcut(key: string, callback: () => void, ctrl = false, shift = false) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === key.toLowerCase() &&
                e.ctrlKey === ctrl &&
                e.shiftKey === shift &&
                !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
                e.preventDefault();
                callback();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [key, callback, ctrl, shift]);
}

// Command palette component
const CommandPalette = ({
    isOpen,
    onClose,
    onExport,
    onRefresh,
    onToggleTheme,
    onSearch,
    onSwitchMetric,
}: {
    isOpen: boolean;
    onClose: () => void;
    onExport: () => void;
    onRefresh: () => void;
    onToggleTheme: () => void;
    onSearch: () => void;
    onSwitchMetric: () => void;
}) => {
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands = [
        { id: "refresh", name: "Refresh Data", shortcut: "R", icon: RefreshCw, action: onRefresh },
        { id: "export", name: "Export to CSV", shortcut: "E", icon: Download, action: onExport },
        { id: "search", name: "Focus Search", shortcut: "/", icon: Search, action: onSearch },
        { id: "theme", name: "Toggle Theme", shortcut: "T", icon: Palette, action: onToggleTheme },
        { id: "metrics", name: "Switch Metrics", shortcut: "M", icon: BarChart3, action: onSwitchMetric },
        {
            id: "fullscreen", name: "Toggle Fullscreen", shortcut: "F", icon: Maximize, action: () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    document.documentElement.requestFullscreen();
                }
            }
        },
    ];

    const filtered = commands.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    const executeCommand = (cmd: typeof commands[0]) => {
        cmd.action();
        onClose();
        setSearch("");
    };

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && filtered[selectedIndex]) {
                e.preventDefault();
                executeCommand(filtered[selectedIndex]);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isOpen, filtered, selectedIndex]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700">
                    <input
                        type="text"
                        placeholder="Type a command..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-transparent text-lg outline-none placeholder-gray-500 text-white"
                        autoFocus
                    />
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                    {filtered.map((cmd, i) => {
                        const IconComponent = cmd.icon;
                        return (
                            <button
                                key={cmd.id}
                                onClick={() => executeCommand(cmd)}
                                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${i === selectedIndex ? "bg-purple-500/20 border border-purple-500/50" : "hover:bg-gray-800 border border-transparent"}`}
                            >
                                <IconComponent className="w-5 h-5 text-gray-400" />
                                <span className="flex-1 text-white">{cmd.name}</span>
                                <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">{cmd.shortcut}</kbd>
                            </button>
                        );
                    })}
                </div>
                <div className="p-3 border-t border-gray-700 text-xs text-gray-500 flex items-center gap-4">
                    <span><kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd> navigate</span>
                    <span><kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Enter</kbd> select</span>
                    <span><kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
};

// Animated counter component
const AnimatedValue = ({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) => (
    <span className="tabular-nums">{prefix}{value}{suffix}</span>
);

// Sparkline mini component
const MiniSparkline = ({ data, color }: { data: number[]; color: string }) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v - min) / range) * 100}`).join(" ");

    return (
        <svg viewBox="0 0 100 100" className="w-20 h-8" preserveAspectRatio="none">
            <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline
                fill={`url(#spark-${color})`}
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={`0,100 ${points} 100,100`}
            />
        </svg>
    );
};

// Enhanced KPI Card
const EnhancedKPICard = ({
    title,
    value,
    subtitle,
    trend,
    trendUp,
    icon,
    color = "primary",
    sparkData,
    onClick,
}: {
    title: string;
    value: string;
    subtitle?: string;
    trend?: string;
    trendUp?: boolean;
    icon: React.ReactNode;
    color?: "primary" | "success" | "warning" | "danger" | "cyan";
    sparkData?: number[];
    onClick?: () => void;
}) => {
    const colorClasses = {
        primary: "from-purple-500/20 to-purple-500/5 border-purple-500/30 hover:border-purple-500/50",
        success: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 hover:border-emerald-500/50",
        warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30 hover:border-amber-500/50",
        danger: "from-rose-500/20 to-rose-500/5 border-rose-500/30 hover:border-rose-500/50",
        cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 hover:border-cyan-500/50",
    };

    const iconColors = {
        primary: "text-purple-400 bg-purple-500/20",
        success: "text-emerald-400 bg-emerald-500/20",
        warning: "text-amber-400 bg-amber-500/20",
        danger: "text-rose-400 bg-rose-500/20",
        cyan: "text-cyan-400 bg-cyan-500/20",
    };

    const sparkColors = {
        primary: "#a78bfa",
        success: "#34d399",
        warning: "#fbbf24",
        danger: "#f87171",
        cyan: "#22d3ee",
    };

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorClasses[color]} p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer group`}
            onClick={onClick}
        >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-radial from-white/5 to-transparent rounded-full -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-start justify-between">
                <div className="relative z-10">
                    <p className="text-sm text-gray-400 font-medium">{title}</p>
                    <p className="text-2xl font-display font-bold mt-1 text-white">
                        <AnimatedValue value={value} />
                    </p>
                    {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${trendUp ? "text-emerald-400" : "text-rose-400"}`}>
                            <svg className={`w-4 h-4 ${trendUp ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            {trend}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`w-10 h-10 rounded-xl ${iconColors[color]} flex items-center justify-center`}>
                        {icon}
                    </div>
                    {sparkData && <MiniSparkline data={sparkData} color={sparkColors[color]} />}
                </div>
            </div>
        </div>
    );
};

// Campaign modal
const CampaignModal = ({ campaign, onClose }: { campaign: Campaign | null; onClose: () => void }) => {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!campaign) return null;

    const cpa = campaign.cost / Math.max(campaign.conversions, 1);
    const estimatedValue = campaign.conversions * 500;
    const roas = estimatedValue / campaign.cost;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-display font-bold text-white">{campaign.name}</h2>
                        <p className="text-sm text-gray-400">Account: {campaign.account} | {campaign.bidStrategy}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Primary Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Clicks</p>
                        <p className="text-xl font-bold text-white">{formatNumber(campaign.clicks)}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Impressions</p>
                        <p className="text-xl font-bold text-white">{formatNumber(campaign.impressions)}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Cost</p>
                        <p className="text-xl font-bold text-amber-400">{formatCurrency(campaign.cost)}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
                        <p className="text-xs text-gray-400 mb-1">Conversions</p>
                        <p className="text-xl font-bold text-emerald-400">{campaign.conversions.toFixed(0)}</p>
                    </div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">CTR</p>
                        <p className="font-semibold text-white">{campaign.ctr.toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">Avg CPC</p>
                        <p className="font-semibold text-white">Rs.{campaign.avgCpc.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">Conv Rate</p>
                        <p className="font-semibold text-white">{campaign.conversionRate.toFixed(2)}%</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">CPA</p>
                        <p className="font-semibold text-amber-400">Rs.{cpa.toFixed(2)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">ROAS</p>
                        <p className={`font-semibold ${roas >= 1 ? "text-emerald-400" : "text-rose-400"}`}>{roas.toFixed(2)}x</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">Budget</p>
                        <p className="font-semibold text-white">Rs.{campaign.budget.toLocaleString()}</p>
                    </div>
                </div>

                {/* Performance Gauges */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <GaugeChart value={campaign.optimizationScore} max={100} label="Optimization" color="#a78bfa" />
                    <GaugeChart value={campaign.searchImprShare || 0} max={100} label="Search Impr Share" color="#22d3ee" />
                    <GaugeChart value={campaign.conversionRate} max={100} label="Conv Rate" color="#34d399" />
                </div>

                {/* Status & Recommendations */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${campaign.optimizationScore >= 80 ? "bg-emerald-500/20 text-emerald-400" : campaign.optimizationScore >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-rose-500/20 text-rose-400"}`}>
                            Score: {campaign.optimizationScore}%
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                            Top IS: {campaign.searchTopIS}%
                        </span>
                    </div>

                    {campaign.statusReasons && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm">
                            <span className="text-amber-400 font-medium">Attention:</span>
                            <span className="text-gray-300 ml-2">{campaign.statusReasons}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Quick stats bar
const QuickStatsBar = ({ campaigns: campList }: { campaigns: Campaign[] }) => {
    const activeCampaigns = campList.filter(c => c.status === "Enabled").length;
    const highPerformers = campList.filter(c => c.conversionRate >= 50).length;
    const needsAttention = campList.filter(c => c.statusReasons && c.statusReasons.length > 0).length;

    return (
        <div className="flex items-center gap-6 p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 mb-6">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm text-gray-400">{activeCampaigns} Active</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-sm text-gray-400">{highPerformers} High Performers</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-sm text-gray-400">{needsAttention} Need Attention</span>
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">?</kbd>
                <span>Shortcuts</span>
            </div>
        </div>
    );
};

// Icons
const ClicksIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
);

const ImpressionsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const CostIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const ConversionsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CTRIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);

const CPCIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
);

const ROASIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

export default function DashboardPage() {
    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<"clicks" | "cost" | "conversions">("clicks");
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [comparisonMode, setComparisonMode] = useState(false);
    const [selectedView, setSelectedView] = useState<"overview" | "performance" | "budget">("overview");

    // Keyboard shortcuts
    useKeyboardShortcut('k', () => setShowCommandPalette(true), true);
    useKeyboardShortcut('?', () => setShowCommandPalette(true));
    useKeyboardShortcut('escape', () => {
        setShowCommandPalette(false);
        setSelectedCampaign(null);
    });
    useKeyboardShortcut('1', () => setSelectedMetric("clicks"));
    useKeyboardShortcut('2', () => setSelectedMetric("cost"));
    useKeyboardShortcut('3', () => setSelectedMetric("conversions"));
    useKeyboardShortcut('c', () => setComparisonMode(prev => !prev));
    useKeyboardShortcut('e', handleExport);
    useKeyboardShortcut('r', handleRefresh);
    useKeyboardShortcut('t', handleToggleTheme);
    useKeyboardShortcut('/', handleFocusSearch);
    useKeyboardShortcut('m', handleSwitchMetric);

    // Command handlers
    const searchInputRef = { current: null as HTMLInputElement | null };

    function handleExport() {
        const headers = ["Campaign", "Account", "Clicks", "Impressions", "Cost", "Conversions", "CTR", "Conv Rate"];
        const csvContent = [
            headers.join(","),
            ...campaigns.map(c => [
                `"${c.name}"`,
                c.account,
                c.clicks,
                c.impressions,
                c.cost.toFixed(2),
                c.conversions.toFixed(2),
                c.ctr.toFixed(2),
                c.conversionRate.toFixed(2)
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaigns_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function handleRefresh() {
        window.location.reload();
    }

    function handleToggleTheme() {
        document.documentElement.classList.toggle('dark');
    }

    function handleFocusSearch() {
        const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
    }

    function handleSwitchMetric() {
        setSelectedMetric(prev => {
            if (prev === "clicks") return "cost";
            if (prev === "cost") return "conversions";
            return "clicks";
        });
    }

    // Derived calculations
    const avgROAS = useMemo(() => {
        const totalValue = totals.conversions * 500;
        return totalValue / totals.cost;
    }, []);

    const budgetUtilization = useMemo(() => {
        const totalBudget = totals.totalBudget * 31; // Monthly budget
        return (totals.cost / totalBudget) * 100;
    }, []);

    // Sparkline data
    const clicksSparkData = dailyTrend.slice(-14).map(d => d.clicks);
    const costSparkData = dailyTrend.slice(-14).map(d => d.cost);
    const convSparkData = dailyTrend.slice(-14).map(d => d.conversions);
    const ctrSparkData = dailyTrend.slice(-14).map(d => d.ctr);

    // Chart data - use pre-formatted date labels
    const trendData = dailyTrend.map(d => {
        const day = parseInt(d.date.split("-")[2], 10);
        return {
            date: `Oct ${day}`,
            clicks: d.clicks,
            cost: Math.round(d.cost / 1000),
            conversions: d.conversions,
        };
    });

    const accountData = accountBreakdown.map(a => ({
        name: a.account,
        value: a.cost,
        campaigns: a.campaigns,
        clicks: a.clicks,
    }));

    const campaignCostData = campaigns
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 10)
        .map(c => ({
            name: c.name.length > 20 ? c.name.slice(0, 20) + "..." : c.name,
            cost: c.cost,
            conversions: c.conversions,
        }));

    // Table columns
    const campaignColumns = [
        {
            key: "name",
            header: "Campaign",
            sortable: true,
            render: (value: string, row: Campaign) => (
                <button
                    onClick={() => setSelectedCampaign(row)}
                    className="text-left hover:text-purple-400 transition-colors font-medium"
                >
                    {value}
                </button>
            )
        },
        { key: "account", header: "Account", sortable: true },
        { key: "clicks", header: "Clicks", format: "number" as const, align: "right" as const, sortable: true },
        { key: "impressions", header: "Impr.", format: "number" as const, align: "right" as const, sortable: true },
        { key: "cost", header: "Cost", format: "currency" as const, align: "right" as const, sortable: true },
        { key: "conversions", header: "Conv.", format: "number" as const, align: "right" as const, sortable: true },
        { key: "ctr", header: "CTR", format: "percent" as const, align: "right" as const, sortable: true },
        {
            key: "conversionRate",
            header: "Conv Rate",
            align: "right" as const,
            sortable: true,
            render: (value: number) => (
                <span className={`font-medium ${value >= 50 ? "text-emerald-400" : value >= 30 ? "text-white" : "text-amber-400"}`}>
                    {value.toFixed(1)}%
                </span>
            ),
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <p className="text-gray-400 mt-1">EFF24 Account Performance - Oct 1-31, 2025</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-800/50 rounded-lg px-3 py-1.5">
                        {(["overview", "performance", "budget"] as const).map(view => (
                            <button
                                key={view}
                                onClick={() => setSelectedView(view)}
                                className={`px-3 py-1 rounded text-sm transition-colors ${selectedView === view ? "bg-purple-500 text-white" : "text-gray-400 hover:text-white"}`}
                            >
                                {view.charAt(0).toUpperCase() + view.slice(1)}
                            </button>
                        ))}
                    </div>
                    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25">
                        {totals.campaignCount} Campaigns
                    </span>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <QuickStatsBar campaigns={campaigns} />

            {/* AI Summary */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-900/40 via-gray-900 to-cyan-900/40 p-6 border border-purple-500/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(139,92,246,0.15),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(6,182,212,0.15),transparent_50%)]" />
                <div className="relative flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/30">
                        <span className="text-xl text-white font-bold">AI</span>
                    </div>
                    <div>
                        <p className="font-medium text-sm text-purple-400 mb-2">Performance Intelligence</p>
                        <p className="text-lg leading-relaxed text-gray-200">
                            You spent <span className="font-bold text-amber-400">{formatCurrency(totals.cost)}</span> and generated{" "}
                            <span className="font-bold text-emerald-400">{formatNumber(totals.conversions)} conversions</span> at{" "}
                            <span className="font-bold text-purple-400">{avgROAS.toFixed(2)}x ROAS</span>. Top performer:{" "}
                            <span className="font-bold text-cyan-400">Pmall-MB</span> with 1,472 conversions.{" "}
                            <span className="text-gray-400">Budget utilization at {budgetUtilization.toFixed(0)}%.</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                <EnhancedKPICard
                    title="Total Clicks"
                    value={formatNumber(totals.clicks)}
                    subtitle={`${formatNumber(totals.impressions)} impr.`}
                    icon={<ClicksIcon />}
                    color="primary"
                    sparkData={clicksSparkData}
                />
                <EnhancedKPICard
                    title="Total Cost"
                    value={formatCurrency(totals.cost)}
                    subtitle={`Rs.${totals.avgCpc.toFixed(0)} avg CPC`}
                    icon={<CostIcon />}
                    color="warning"
                    sparkData={costSparkData}
                />
                <EnhancedKPICard
                    title="Conversions"
                    value={formatNumber(totals.conversions)}
                    subtitle={`${totals.conversionRate.toFixed(1)}% rate`}
                    trend="+12.4%"
                    trendUp={true}
                    icon={<ConversionsIcon />}
                    color="success"
                    sparkData={convSparkData}
                />
                <EnhancedKPICard
                    title="CTR"
                    value={`${totals.ctr.toFixed(2)}%`}
                    subtitle="Above avg"
                    icon={<CTRIcon />}
                    color="cyan"
                    sparkData={ctrSparkData}
                />
                <EnhancedKPICard
                    title="Avg CPC"
                    value={`Rs.${totals.avgCpc.toFixed(0)}`}
                    subtitle="Per click"
                    icon={<CPCIcon />}
                    color="warning"
                />
                <EnhancedKPICard
                    title="CPA"
                    value={`Rs.${(totals.cost / totals.conversions).toFixed(0)}`}
                    subtitle="Per conversion"
                    icon={<ConversionsIcon />}
                    color="danger"
                />
                <EnhancedKPICard
                    title="ROAS"
                    value={`${avgROAS.toFixed(2)}x`}
                    subtitle="Return on ad spend"
                    trend="+8.2%"
                    trendUp={true}
                    icon={<ROASIcon />}
                    color="success"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 bg-gray-900/50 rounded-2xl border border-gray-700/50 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <h2 className="text-lg font-display font-semibold text-white">Performance Trends</h2>
                        <div className="flex items-center gap-2">
                            {(["clicks", "cost", "conversions"] as const).map((metric, i) => (
                                <button
                                    key={metric}
                                    onClick={() => setSelectedMetric(metric)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedMetric === metric
                                        ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25"
                                        : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                                        }`}
                                >
                                    <span className="hidden md:inline">{metric.charAt(0).toUpperCase() + metric.slice(1)}</span>
                                    <span className="md:hidden">{i + 1}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <MetricsAreaChart
                        data={trendData}
                        metrics={[{ key: selectedMetric, name: selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1), color: "#8b5cf6" }]}
                        height={300}
                        showAverage
                    />
                </div>

                {/* Account Breakdown Pie */}
                <div className="bg-gray-900/50 rounded-2xl border border-gray-700/50 p-6">
                    <h2 className="text-lg font-display font-semibold text-white mb-4">Cost by Account</h2>
                    <MetricsPieChart data={accountData} height={240} innerRadius={60} showLabels={false} />
                    <div className="mt-4 space-y-2">
                        {accountBreakdown.map((acc, i) => (
                            <div key={acc.account} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-purple-500" : i === 1 ? "bg-cyan-500" : "bg-emerald-500"}`} />
                                    <span className="text-gray-300">{acc.account}</span>
                                </div>
                                <span className="font-medium text-white">{formatCurrency(acc.cost)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top Performers */}
                <div className="bg-gray-900/50 rounded-2xl border border-gray-700/50 p-6">
                    <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="text-emerald-400">Top</span> Performers by ROAS
                    </h2>
                    <div className="space-y-3">
                        {topPerformers.slice(0, 5).map((camp, i) => (
                            <button
                                key={camp.id}
                                onClick={() => setSelectedCampaign(camp)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/50 transition-colors text-left border border-transparent hover:border-gray-700"
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-orange-500/30" :
                                    i === 1 ? "bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800" :
                                        i === 2 ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white" :
                                            "bg-gray-700 text-gray-300"
                                    }`}>
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{camp.name}</p>
                                    <p className="text-xs text-gray-500">{camp.conversions.toFixed(0)} conv @ Rs.{camp.cpa.toFixed(0)} CPA</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-400">{camp.roas.toFixed(2)}x</p>
                                    <p className="text-xs text-gray-500">ROAS</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Account Performance Cards */}
                <div className="bg-gray-900/50 rounded-2xl border border-gray-700/50 p-6">
                    <h2 className="text-lg font-display font-semibold text-white mb-4">Account Performance</h2>
                    <div className="space-y-4">
                        {accountBreakdown.map((acc, i) => (
                            <div key={acc.account} className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50 hover:border-gray-600 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${i === 0 ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30" :
                                            i === 1 ? "bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/30" :
                                                "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30"
                                            }`}>
                                            {acc.account.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-white">{acc.account}</p>
                                            <p className="text-xs text-gray-500">{acc.campaigns} campaigns</p>
                                        </div>
                                    </div>
                                    <p className="text-lg font-bold text-white">{formatCurrency(acc.cost)}</p>
                                </div>
                                <ProgressBar
                                    value={acc.cost}
                                    max={totals.cost}
                                    color={i === 0 ? "primary" : i === 1 ? "warning" : "success"}
                                    size="sm"
                                    showValue={false}
                                />
                                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                                    <div>
                                        <p className="text-gray-500 text-xs">Clicks</p>
                                        <p className="font-medium text-white">{formatNumber(acc.clicks)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs">Conversions</p>
                                        <p className="font-medium text-white">{formatNumber(acc.conversions)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs">CPA</p>
                                        <p className="font-medium text-white">Rs.{(acc.cost / acc.conversions).toFixed(0)}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Campaigns Bar Chart */}
            <div className="bg-gray-900/50 rounded-2xl border border-gray-700/50 p-6">
                <h2 className="text-lg font-display font-semibold text-white mb-4">Top 10 Campaigns by Spend</h2>
                <MetricsBarChart
                    data={campaignCostData}
                    metrics={[
                        { key: "cost", name: "Cost", color: "#f59e0b" },
                        { key: "conversions", name: "Conversions", color: "#22c55e" }
                    ]}
                    height={300}
                    format="currency"
                />
            </div>

            {/* Campaign Table */}
            <DataTable
                data={campaigns}
                columns={campaignColumns}
                title="All Campaigns"
                searchKeys={["name", "account"]}
                pageSize={10}
            />

            {/* Campaign Modal */}
            <CampaignModal campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onExport={handleExport}
                onRefresh={handleRefresh}
                onToggleTheme={handleToggleTheme}
                onSearch={handleFocusSearch}
                onSwitchMetric={handleSwitchMetric}
            />
        </div>
    );
}
