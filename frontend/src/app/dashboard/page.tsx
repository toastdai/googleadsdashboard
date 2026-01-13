// Dynamic Dashboard - Production Ready - 2025-01-10
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useKelkooData, calculateCampaignKelkooData } from "@/hooks/useKelkooData";
import { useAdmediaData, calculateCampaignAdmediaData } from "@/hooks/useAdmediaData";
import { useMaxBountyData, calculateCampaignMaxBountyData } from "@/hooks/useMaxBountyData";
import { useDashboardData, BreakdownItem } from "@/hooks/useDashboardData";
import { DateRangePicker } from "@/components/date-range-picker";
import { useDateRange } from "@/lib/date-context";
import {
    RefreshCw,
    Download,
    Search,
    BarChart3,
    Maximize,
    Star,
    AlertTriangle,
    AlertCircle,
    Activity,
} from "lucide-react";
import {
    formatCurrency,
    formatNumber,
    Campaign
} from "@/lib/campaign-data";
import {
    calculateHealthScore,
    calculateEfficiencyRating,
    calculateRiskLevel
} from "@/lib/dashboard-utils";
import {
    MetricsAreaChart,
    MetricsBarChart,
    MetricsPieChart,
    GaugeChart,
    ProgressBar,
} from "@/components/charts";
import { DataTable } from "@/components/data-table";

// Safe number formatter - prevents toFixed errors
const safeToFixed = (value: any, decimals: number = 2): string => {
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return "0";
    return num.toFixed(decimals);
};

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
    onSearch,
    onSwitchMetric,
}: {
    isOpen: boolean;
    onClose: () => void;
    onExport: () => void;
    onRefresh: () => void;
    onSearch: () => void;
    onSwitchMetric: () => void;
}) => {
    const [search, setSearch] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);

    const commands = [
        { id: "refresh", name: "Refresh Data", shortcut: "R", icon: RefreshCw, action: onRefresh },
        { id: "export", name: "Export to CSV", shortcut: "E", icon: Download, action: onExport },
        { id: "search", name: "Focus Search", shortcut: "/", icon: Search, action: onSearch },
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

// Info Tooltip component - shows formula/info on hover (uses portal for visibility)
const InfoTooltip = ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => {
    const [show, setShow] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top - 10,
                left: rect.left + rect.width / 2,
            });
        }
        setShow(true);
    };

    return (
        <>
            <span
                ref={triggerRef}
                className="relative inline-flex items-center gap-1 cursor-help"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={() => setShow(false)}
            >
                {children}
                <svg className="w-3.5 h-3.5 text-gray-500 hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </span>
            {show && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed z-[9999] w-72 p-4 bg-gray-900 border border-cyan-500/30 rounded-xl shadow-2xl shadow-cyan-500/10 text-xs text-gray-300 leading-relaxed animate-fade-in pointer-events-none"
                    style={{
                        top: position.top,
                        left: position.left,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-r border-b border-cyan-500/30 rotate-45" />
                    {content}
                </div>,
                document.body
            )}
        </>
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
const CampaignModal = ({ campaign, onClose }: { campaign: (Campaign & { actualROAS?: number; kelkooRevenueInr?: number; admediaEarningsInr?: number; maxBountyEarningsInr?: number; conversion_value?: number }) | null; onClose: () => void }) => {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    if (!campaign) return null;

    const cpa = campaign.cost / Math.max(campaign.conversions, 1);
    // Use actual conversion_value or partner revenue for ROAS
    const partnerRevenue = (campaign.kelkooRevenueInr || 0) + (campaign.admediaEarningsInr || 0) + (campaign.maxBountyEarningsInr || 0);
    const conversionValue = campaign.conversion_value || partnerRevenue || 0;
    const roas = campaign.actualROAS || (campaign.cost > 0 ? conversionValue / campaign.cost : 0);

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
                        <p className="text-xl font-bold text-emerald-400">{safeToFixed(campaign.conversions, 0)}</p>
                    </div>
                </div>

                {/* Secondary Metrics */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">CTR</p>
                        <p className="font-semibold text-white">{safeToFixed(campaign.ctr, 2)}%</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">Avg CPC</p>
                        <p className="font-semibold text-white">Rs.{safeToFixed(campaign.avgCpc, 2)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">Conv Rate</p>
                        <p className="font-semibold text-white">{safeToFixed(campaign.conversionRate, 2)}%</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">CPA</p>
                        <p className="font-semibold text-amber-400">Rs.{safeToFixed(cpa, 2)}</p>
                    </div>
                    <div className="p-3 bg-gray-800/30 rounded-xl">
                        <p className="text-xs text-gray-500">ROAS</p>
                        <p className={`font-semibold ${roas >= 1 ? "text-emerald-400" : "text-rose-400"}`}>{safeToFixed(roas, 2)}x</p>
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

// Quick stats bar - uses enriched campaigns with calculated metrics
const QuickStatsBar = ({ campaigns: campList }: { campaigns: any[] }) => {
    const activeCampaigns = campList.filter(c => c.status === "Enabled").length;
    const highPerformers = campList.filter(c => c.efficiencyRating === "A" || c.efficiencyRating === "B").length;
    const needsAttention = campList.filter(c => c.riskLevel === "Medium" || c.riskLevel === "High").length;

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

// View Banner - Shows different content based on selected view tab
const ViewBanner = ({
    view,
    liveKelkooRevenueInr,
    totals,
    topPerformers,
    bottomPerformers
}: {
    view: "overview" | "performance" | "budget";
    liveKelkooRevenueInr: number;
    totals: {
        clicks: number;
        impressions: number;
        cost: number;
        conversions: number;
        ctr: number;
        avgCpc: number;
        totalBudget: number;
    };
    topPerformers: any[];
    bottomPerformers: any[];
}) => {
    if (view === "overview") return null; // Overview shows default content

    if (view === "performance") {
        return (
            <div className="bg-gradient-to-r from-purple-900/30 via-gray-900 to-cyan-900/30 rounded-2xl p-6 border border-purple-500/20 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-display font-bold text-white">Performance View</h2>
                        <p className="text-sm text-gray-400">Key performance metrics and conversion analysis</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-purple-400">{safeToFixed(totals.conversions / totals.clicks * 100, 1)}%</p>
                        <p className="text-xs text-gray-400 mt-1">Conversion Rate</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-cyan-400">{safeToFixed(totals.ctr, 2)}%</p>
                        <p className="text-xs text-gray-400 mt-1">Click-Through Rate</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-emerald-400">{topPerformers.length}</p>
                        <p className="text-xs text-gray-400 mt-1">Top Performers</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-amber-400">{bottomPerformers.length}</p>
                        <p className="text-xs text-gray-400 mt-1">Need Attention</p>
                    </div>
                </div>
            </div>
        );
    }

    if (view === "budget") {
        return (
            <div className="bg-gradient-to-r from-amber-900/30 via-gray-900 to-emerald-900/30 rounded-2xl p-6 border border-amber-500/20 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-display font-bold text-white">Budget View</h2>
                        <p className="text-sm text-gray-400">Cost analysis and budget utilization</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-amber-400">{formatCurrency(totals.cost)}</p>
                        <p className="text-xs text-gray-400 mt-1">Total Spend</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-white">Rs.{safeToFixed(totals.avgCpc, 0)}</p>
                        <p className="text-xs text-gray-400 mt-1">Avg CPC</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-cyan-400">Rs.{safeToFixed(totals.cost / totals.conversions, 0)}</p>
                        <p className="text-xs text-gray-400 mt-1">CPA</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-emerald-400">{formatCurrency(liveKelkooRevenueInr)}</p>
                        <p className="text-xs text-gray-400 mt-1">Kelkoo Revenue</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-purple-400">{formatCurrency(totals.cost / 31)}</p>
                        <p className="text-xs text-gray-400 mt-1">Daily Avg Spend</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

// Icons
const ClicksIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
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
    // Global Date State from Context (shared across all dashboard pages)
    const { dateRange, setDateRange, dateRangeLabel } = useDateRange();

    const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<"clicks" | "cost" | "conversions">("clicks");
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [, setComparisonMode] = useState(false);
    const [selectedView, setSelectedView] = useState<"overview" | "performance" | "budget">("overview");
    const [activeKPI, setActiveKPI] = useState<string | null>(null);
    const [detailModal, setDetailModal] = useState<{ type: string; title: string; data: Record<string, unknown> } | null>(null);
    const [networkFilter, setNetworkFilter] = useState<"all" | "kelkoo" | "admedia" | "maxbounty">("all");

    // Fetch Live Dashboard Data from Postgres (Sync Service) OR Live API
    const {
        summary: liveSummary,
        timeSeries: liveTrends,
        topCampaigns: liveTopCampaigns,
        accountBreakdown,
        loading: liveLoading,
        isFetchingLive,
        dataSource,
        refetchLive,
        error
    } = useDashboardData(dateRange.start, dateRange.end);

    // Fetch Partner Data dynamically from API (Legacy/Partner)
    const { data: kelkooApiData, loading: kelkooLoading, error: kelkooError, isFallback: kelkooIsFallback, refetch: refetchKelkoo } = useKelkooData(dateRange.start, dateRange.end);

    // Fetch Admedia data dynamically from API
    const { data: admediaApiData, loading: admediaLoading, error: admediaError, isFallback: admediaIsFallback, refetch: refetchAdmedia } = useAdmediaData(dateRange.start, dateRange.end);

    // Fetch MaxBounty data dynamically from API
    const { data: maxBountyApiData, campaigns: maxBountyCampaigns, loading: maxBountyLoading, error: maxBountyError, isFallback: maxBountyIsFallback, refetch: refetchMaxBounty } = useMaxBountyData(dateRange.start, dateRange.end);

    // Live Kelkoo aggregates from API
    const liveKelkooAggregates = useMemo(() => {
        if (!kelkooApiData) return {
            totalLeads: 0,
            totalRevenueEur: 0,
            totalRevenueInr: 0,
            totalSales: 0,
            totalSaleValueEur: 0,
            totalSaleValueInr: 0,
            cpc: 0,
            vpl: 0,
            conversionRate: 0,
            klCampaignCount: 0,
        };
        const EUR_TO_INR = 89.5;
        return {
            totalLeads: kelkooApiData.leadCount,
            totalRevenueEur: kelkooApiData.leadEstimatedRevenueInEur,
            totalRevenueInr: kelkooApiData.leadEstimatedRevenueInEur * EUR_TO_INR,
            totalSales: kelkooApiData.saleCount,
            totalSaleValueEur: kelkooApiData.saleValueInEur,
            totalSaleValueInr: kelkooApiData.saleValueInEur * EUR_TO_INR,
            cpc: kelkooApiData.leadEstimatedRevenueInEur / kelkooApiData.leadCount,
            vpl: kelkooApiData.valuePerLeadInEur,
            conversionRate: kelkooApiData.crPercentage,
            klCampaignCount: 0, // Will be computed from liveEnrichedCampaigns
        };
    }, [kelkooApiData]);

    // Live Admedia aggregates from API
    const liveAdmediaAggregates = useMemo(() => {
        if (!admediaApiData) return {
            totalLeads: 0,
            totalConversions: 0,
            totalEarningsUsd: 0,
            totalEarningsInr: 0,
            conversionRate: 0,
            amCampaignCount: 0,
            cpc: 0,
            cpl: 0,
        };
        return {
            totalLeads: admediaApiData.leads,
            totalConversions: admediaApiData.conversions,
            totalEarningsUsd: admediaApiData.earnings,
            totalEarningsInr: admediaApiData.earningsInr,
            conversionRate: admediaApiData.leads > 0 ? (admediaApiData.conversions / admediaApiData.leads) * 100 : 0,
            amCampaignCount: 0, // Will be computed from liveEnrichedCampaigns
            cpc: admediaApiData.cpc,
            cpl: admediaApiData.cpl,
        };
    }, [admediaApiData]);

    // Live MaxBounty aggregates from API
    const liveMaxBountyAggregates = useMemo(() => {
        if (!maxBountyApiData) return {
            clicks: 0,
            leads: 0,
            earnings: 0,
            earningsInr: 0,
            conversion: 0,
            epc: 0,
            sales: 0,
            campaignCount: 0,
        };
        return {
            clicks: maxBountyApiData.clicks,
            leads: maxBountyApiData.leads,
            earnings: maxBountyApiData.earnings,
            earningsInr: maxBountyApiData.earningsInr,
            conversion: maxBountyApiData.conversion,
            epc: maxBountyApiData.epc,
            sales: maxBountyApiData.sales,
            campaignCount: maxBountyCampaigns.length,
        };
    }, [maxBountyApiData, maxBountyCampaigns]);

    // Helper: detect network from campaign name (handles both "-kl" and " - KL" formats)
    const detectNetwork = (name: string) => {
        const n = name.toLowerCase();
        return {
            isKelkoo: /[\s-]+kl$/i.test(n),
            isAdmedia: /[\s-]+am$/i.test(n),
            isMaxBounty: /[\s-]+mb$/i.test(n),
        };
    };

    // Enrich campaigns with live Kelkoo, Admedia, MaxBounty data AND calculate AI metrics
    const liveEnrichedCampaigns = useMemo(() => {
        // Map live backend data to Campaign interface with calculated metrics
        let result = liveTopCampaigns.map(c => {
            // Convert Decimal values from backend to Numbers
            const cost = Number(c.cost) || 0;
            const clicks = Number(c.clicks) || 0;
            const conversions = Number(c.conversions) || 0;
            const conversionValue = Number(c.conversion_value) || 0;
            const impressions = Number(c.impressions) || 0;

            // Calculate derived metrics from raw data
            const avgCpc = clicks > 0 ? cost / clicks : 0;
            const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;

            // Create enriched campaign object
            const enrichedCampaign = {
                ...c,
                id: c.id || c.name, // Use name as fallback ID
                cost,
                clicks,
                conversions,
                impressions,
                conversion_value: conversionValue,
                avgCpc,
                conversionRate,
                cpa,
                // Map conversion_value to revenue if missing
                revenue: conversionValue,
                status: "Enabled", // Backend returns active campaigns
                roas: cost > 0 ? conversionValue / cost : 0,
                // Network flags
                ...detectNetwork(c.name),
            };

            // Calculate AI-based health metrics using the same input format as BreakdownItem
            const healthScore = calculateHealthScore(c as BreakdownItem);
            const efficiencyRating = calculateEfficiencyRating(c as BreakdownItem);
            const riskLevel = calculateRiskLevel(c as BreakdownItem);

            return {
                ...enrichedCampaign,
                healthScore,
                efficiencyRating,
                riskLevel,
            };
        }) as any[];

        // Enrich with Kelkoo data
        if (kelkooApiData) {
            const klCampaigns = result.filter(c => detectNetwork(c.name).isKelkoo);
            const totalKLClicks = klCampaigns.reduce((sum, c) => sum + c.clicks, 0);

            result = result.map(campaign => {
                if (!detectNetwork(campaign.name).isKelkoo) return campaign;

                const kelkooData = calculateCampaignKelkooData(
                    kelkooApiData,
                    campaign.clicks,
                    totalKLClicks,
                    campaign.cost
                );

                return { ...campaign, ...kelkooData };
            });
        }

        // Enrich with Admedia data
        if (admediaApiData) {
            const amCampaigns = result.filter(c => detectNetwork(c.name).isAdmedia);
            const totalAMClicks = amCampaigns.reduce((sum, c) => sum + c.clicks, 0);

            result = result.map(campaign => {
                if (!detectNetwork(campaign.name).isAdmedia) return campaign;

                const admediaData = calculateCampaignAdmediaData(
                    admediaApiData,
                    campaign.clicks,
                    totalAMClicks,
                    campaign.cost
                );

                return { ...campaign, ...admediaData };
            });
        }

        // Enrich with MaxBounty data
        if (maxBountyApiData) {
            const mbCampaigns = result.filter(c => detectNetwork(c.name).isMaxBounty);
            const totalMBClicks = mbCampaigns.reduce((sum, c) => sum + c.clicks, 0);

            result = result.map(campaign => {
                if (!detectNetwork(campaign.name).isMaxBounty) return campaign;

                const maxBountyData = calculateCampaignMaxBountyData(
                    maxBountyApiData,
                    campaign.clicks,
                    totalMBClicks,
                    campaign.cost
                );

                return { ...campaign, ...maxBountyData };
            });
        }

        // Final pass: Update roas to use actualROAS for partner campaigns (calculated with partner revenue)
        result = result.map(campaign => {
            if (campaign.actualROAS !== undefined && campaign.actualROAS > 0) {
                return { ...campaign, roas: campaign.actualROAS };
            }
            return campaign;
        });

        return result;
    }, [liveTopCampaigns, kelkooApiData, admediaApiData, maxBountyApiData]);

    const filteredCampaigns = useMemo(() => {
        return liveEnrichedCampaigns.filter(c => {
            const net = detectNetwork(c.name);
            if (networkFilter === "kelkoo") return net.isKelkoo;
            if (networkFilter === "admedia") return net.isAdmedia;
            if (networkFilter === "maxbounty") return net.isMaxBounty;
            return true;
        });
    }, [liveEnrichedCampaigns, networkFilter]);

    const networkComparison = useMemo(() => {
        const base = {
            cost: 0,
            revenueInr: 0,
            roas: 0,
        };

        const stats = {
            kelkoo: { ...base },
            admedia: { ...base },
            maxbounty: { ...base },
        };

        liveEnrichedCampaigns.forEach(c => {
            // Use the already-set network flags from enrichment
            // Convert values to Numbers in case they are Decimals from backend
            const costNum = Number(c.cost) || 0;
            if (c.isKelkoo) {
                stats.kelkoo.cost += costNum;
                stats.kelkoo.revenueInr += Number(c.kelkooRevenueInr) || 0;
            } else if (c.isAdmedia) {
                stats.admedia.cost += costNum;
                stats.admedia.revenueInr += Number(c.admediaEarningsInr) || 0;
            } else if (c.isMaxBounty) {
                stats.maxbounty.cost += costNum;
                stats.maxbounty.revenueInr += Number(c.maxBountyEarningsInr) || 0;
            }
        });

        (Object.keys(stats) as Array<keyof typeof stats>).forEach(key => {
            const s = stats[key];
            s.roas = s.cost > 0 ? Math.round((s.revenueInr / s.cost) * 100) / 100 : 0;
        });

        return stats;
    }, [liveEnrichedCampaigns]);

    // Compute totals from live data
    const totals = useMemo(() => {
        const result = {
            clicks: Number(liveSummary?.clicks.value) || 0,
            impressions: Number(liveSummary?.impressions.value) || 0,
            cost: Number(liveSummary?.cost.value) || 0,
            conversions: Number(liveSummary?.conversions.value) || 0,
            ctr: Number(liveSummary?.ctr.value) || 0,
            avgCpc: Number(liveSummary?.cpc.value) || 0,
            totalBudget: 0
        };

        // Calculate total budget from campaigns
        liveEnrichedCampaigns.forEach(c => {
            if (c.budget) result.totalBudget += Number(c.budget) || 0;
        });

        return result;
    }, [liveSummary, liveEnrichedCampaigns]);

    // Compute conversion rate
    const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

    // Compute top and bottom performers from live data
    const topPerformers = useMemo(() => {
        return liveEnrichedCampaigns
            .filter(c => c.status === "Enabled" && (c.roas > 0 || c.conversions > 0))
            .sort((a, b) => (b.roas || 0) - (a.roas || 0))
            .slice(0, 5);
    }, [liveEnrichedCampaigns]);

    const bottomPerformers = useMemo(() => {
        return liveEnrichedCampaigns
            .filter(c => c.status === "Enabled" && c.cost > 1000)
            .sort((a, b) => (a.roas || 0) - (b.roas || 0))
            .slice(0, 5);
    }, [liveEnrichedCampaigns]);

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
    useKeyboardShortcut('/', handleFocusSearch);
    useKeyboardShortcut('m', handleSwitchMetric);

    function handleExport() {
        const headers = ["Campaign", "Account", "Clicks", "Impressions", "Cost", "Conversions", "CTR", "Conv Rate"];
        const csvContent = [
            headers.join(","),
            ...liveEnrichedCampaigns.map(c => [
                `"${c.name}"`,
                c.account || "",
                c.clicks,
                c.impressions,
                safeToFixed(c.cost, 2),
                safeToFixed(c.conversions, 2),
                safeToFixed(c.ctr, 2),
                safeToFixed(c.conversionRate, 2)
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
        refetchKelkoo();
        refetchAdmedia();
        refetchMaxBounty();
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

    // Derived calculations - use actual conversion_value from API
    const avgROAS = useMemo(() => {
        // Use actual conversion_value if available from liveSummary, else calculate from partner data
        const totalConversionValue = liveSummary?.conversion_value?.value || 0;
        if (totalConversionValue > 0 && totals.cost > 0) {
            return totalConversionValue / totals.cost;
        }
        // Fallback: Calculate from partner revenue
        const partnerRevenue = networkComparison.kelkoo.revenueInr +
            networkComparison.admedia.revenueInr +
            networkComparison.maxbounty.revenueInr;
        return totals.cost > 0 ? partnerRevenue / totals.cost : 0;
    }, [totals, liveSummary, networkComparison]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const budgetUtilization = useMemo(() => {
        const totalBudget = totals.totalBudget * 31; // Monthly budget
        return totalBudget > 0 ? (totals.cost / totalBudget) * 100 : 0;
    }, [totals]);

    // Compute daily trend from live timeseries data
    const dailyTrend = useMemo(() => {
        if (!liveTrends || liveTrends.length === 0) return [];

        // Get all dates from the first metric
        const dates = liveTrends[0]?.data || [];

        return dates.map(datePoint => {
            const clicks = liveTrends.find(m => m.metric === "clicks")?.data.find(d => d.date === datePoint.date)?.value || 0;
            const impressions = liveTrends.find(m => m.metric === "impressions")?.data.find(d => d.date === datePoint.date)?.value || 0;
            const cost = liveTrends.find(m => m.metric === "cost")?.data.find(d => d.date === datePoint.date)?.value || 0;
            const conversions = liveTrends.find(m => m.metric === "conversions")?.data.find(d => d.date === datePoint.date)?.value || 0;

            return {
                date: datePoint.date,
                clicks,
                impressions,
                cost,
                conversions,
                ctr: impressions > 0 ? (clicks / impressions) * 100 : 0
            };
        });
    }, [liveTrends]);

    // Sparkline data
    const clicksSparkData = dailyTrend.slice(-14).map(d => d.clicks);
    const costSparkData = dailyTrend.slice(-14).map(d => d.cost);
    const convSparkData = dailyTrend.slice(-14).map(d => d.conversions);
    const ctrSparkData = dailyTrend.slice(-14).map(d => d.ctr);

    // Chart data - use pre-formatted date labels
    const trendData = useMemo(() => {
        if (!liveTrends.length) return [];

        // Get all unique dates across all metrics to handle missing data points
        const allDates = new Set<string>();
        liveTrends.forEach(t => t.data.forEach(d => allDates.add(d.date)));

        const sortedDates = Array.from(allDates).sort();
        const clickSeries = liveTrends.find(t => t.metric === 'clicks')?.data || [];
        const costSeries = liveTrends.find(t => t.metric === 'cost')?.data || [];
        const convSeries = liveTrends.find(t => t.metric === 'conversions')?.data || [];

        return sortedDates.map(dateStr => {
            const dateObj = new Date(dateStr);
            // Format: "Oct 1"
            const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            return {
                date: dateLabel,
                clicks: clickSeries.find(c => c.date === dateStr)?.value || 0,
                cost: costSeries.find(c => c.date === dateStr)?.value || 0,
                conversions: convSeries.find(c => c.date === dateStr)?.value || 0,
            };
        });
    }, [liveTrends]);

    const accountData = useMemo(() => accountBreakdown.map(a => ({
        name: a.name, // "account" vs "name" - check hook type
        value: a.cost,
        campaigns: 0, // Not currently returned by backend breakdown
        clicks: a.clicks,
    })), [accountBreakdown]);

    const campaignCostData = liveTopCampaigns
        .slice(0, 10)
        .map(c => ({
            name: c.name.length > 20 ? c.name.slice(0, 20) + "..." : c.name,
            cost: c.cost,
            conversions: c.conversions,
        }));

    // Table columns with Kelkoo, Admedia, and AI data - Simplified and consolidated
    const campaignColumns = [
        {
            key: "name",
            header: "Campaign",
            sortable: true,
            render: (value: string, row: Campaign & { isKelkoo?: boolean; isAdmedia?: boolean; isMaxBounty?: boolean }) => (
                <button
                    onClick={() => setSelectedCampaign(row)}
                    className="text-left hover:text-purple-400 transition-colors font-medium flex items-center gap-2 max-w-[200px]"
                >
                    <span className="flex gap-1 flex-shrink-0">
                        {row.isKelkoo && (
                            <span className="px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-purple-500 to-cyan-500 rounded text-white">KL</span>
                        )}
                        {row.isAdmedia && (
                            <span className="px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 rounded text-white">AM</span>
                        )}
                        {row.isMaxBounty && (
                            <span className="px-1 py-0.5 text-[9px] font-bold bg-gradient-to-r from-rose-500 to-red-500 rounded text-white">MB</span>
                        )}
                    </span>
                    <span className="truncate">{value}</span>
                </button>
            )
        },
        {
            key: "clicks",
            header: "Clicks",
            format: "number" as const,
            align: "right" as const,
            sortable: true,
            render: (value: number, row: Campaign) => (
                <div className="text-right">
                    <p className="font-medium">{value.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">{row.impressions.toLocaleString()} impr</p>
                </div>
            )
        },
        {
            key: "cost",
            header: "Cost",
            align: "right" as const,
            sortable: true,
            render: (value: number, row: Campaign) => (
                <div className="text-right">
                    <p className="font-medium">₹{value.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">₹{safeToFixed(row.avgCpc, 0)} CPC</p>
                </div>
            )
        },
        {
            key: "conversions",
            header: "Conv.",
            align: "right" as const,
            sortable: true,
            render: (value: number, row: Campaign) => (
                <div className="text-right">
                    <p className="font-medium">{value.toLocaleString()}</p>
                    <p className={`text-xs ${row.conversionRate >= 50 ? "text-emerald-400" : row.conversionRate >= 30 ? "text-gray-400" : "text-amber-400"}`}>
                        {safeToFixed(row.conversionRate, 1)}% rate
                    </p>
                </div>
            )
        },
        {
            key: "ctr",
            header: "CTR",
            align: "right" as const,
            sortable: true,
            render: (value: number) => (
                <span className={`font-medium ${value >= 5 ? "text-emerald-400" : value >= 2 ? "text-white" : "text-amber-400"}`}>
                    {safeToFixed(value, 2)}%
                </span>
            )
        },
        {
            key: "healthScore",
            header: (
                <InfoTooltip content={<><strong>Health Score (0-100):</strong><br />• CTR: 30 pts<br />• Conv Rate: 30 pts<br />• Opt Score: 20 pts<br />• Budget util: 20 pts<br /><br /><strong>Efficiency Rating (A-F):</strong><br />Based on conversions per ₹1000 spend</>}>
                    <span>Score</span>
                </InfoTooltip>
            ) as unknown as string,
            align: "center" as const,
            sortable: true,
            render: (value: number | undefined, row: Campaign & { efficiencyRating?: string }) => (
                <div className="flex items-center justify-center gap-1">
                    <span className={`w-8 text-center px-1 py-0.5 rounded text-xs font-bold ${(value || 0) >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                        (value || 0) >= 50 ? "bg-amber-500/20 text-amber-400" :
                            "bg-rose-500/20 text-rose-400"
                        }`}>
                        {value || 0}
                    </span>
                    <span className={`w-5 text-center px-1 py-0.5 rounded text-xs font-bold ${row.efficiencyRating === "A" ? "bg-emerald-500/20 text-emerald-400" :
                        row.efficiencyRating === "B" ? "bg-cyan-500/20 text-cyan-400" :
                            row.efficiencyRating === "C" ? "bg-amber-500/20 text-amber-400" :
                                row.efficiencyRating === "D" ? "bg-orange-500/20 text-orange-400" :
                                    "bg-rose-500/20 text-rose-400"
                        }`}>
                        {row.efficiencyRating || "-"}
                    </span>
                </div>
            ),
        },
        {
            key: "kelkooLeads",
            header: (
                <InfoTooltip content={<><strong>Partner Data:</strong><br />• Leads/clicks from affiliate network<br />• Revenue in INR (commission only)<br /><br /><em>Allocated by click ratio within network.</em></>}>
                    <span>Partner Data</span>
                </InfoTooltip>
            ) as unknown as string,
            align: "right" as const,
            sortable: true,
            render: (value: number | undefined, row: Campaign & { isKelkoo?: boolean; isAdmedia?: boolean; isMaxBounty?: boolean; kelkooRevenueInr?: number; kelkooSaleValueInr?: number; admediaLeads?: number; admediaEarningsInr?: number; maxBountyLeads?: number; maxBountyEarningsInr?: number }) => {
                if (row.isKelkoo) {
                    // Show commission/lead revenue only (excludes gross sale value) to align with ROAS calculation
                    const commissionInr = row.kelkooRevenueInr || 0;
                    return (
                        <div className="text-right">
                            <p className="text-cyan-400 font-medium">{(value || 0).toLocaleString()} leads</p>
                            <p className="text-xs text-emerald-400">₹{commissionInr.toLocaleString()}</p>
                        </div>
                    );
                }
                if (row.isAdmedia) {
                    return (
                        <div className="text-right">
                            <p className="text-amber-400 font-medium">{(row.admediaLeads || 0).toLocaleString()} leads</p>
                            <p className="text-xs text-emerald-400">₹{((row.admediaEarningsInr || 0)).toLocaleString()}</p>
                        </div>
                    );
                }
                if (row.isMaxBounty) {
                    return (
                        <div className="text-right">
                            <p className="text-rose-400 font-medium">{(row.maxBountyLeads || 0).toLocaleString()} leads</p>
                            <p className="text-xs text-emerald-400">₹{((row.maxBountyEarningsInr || 0)).toLocaleString()}</p>
                        </div>
                    );
                }
                return <span className="text-gray-600">-</span>;
            },
        },
        {
            key: "earningsUsd",
            header: "Earnings (USD)",
            align: "right" as const,
            sortable: true,
            render: (_value: number | undefined, row: Campaign & { isKelkoo?: boolean; isAdmedia?: boolean; isMaxBounty?: boolean; kelkooRevenue?: number; kelkooRevenueInr?: number; admediaEarnings?: number; admediaEarningsInr?: number; maxBountyEarnings?: number; maxBountyEarningsInr?: number }) => {
                // EUR to USD conversion rate
                const eurToUsd = 1.08;

                if (row.isKelkoo && row.kelkooRevenue) {
                    // kelkooRevenue is in EUR, convert to USD
                    const usdValue = row.kelkooRevenue * eurToUsd;
                    return <span className="text-cyan-400 font-medium">${safeToFixed(usdValue, 2)}</span>;
                }
                if (row.isAdmedia && row.admediaEarnings) {
                    // admediaEarnings is already in USD
                    return <span className="text-amber-400 font-medium">${safeToFixed(row.admediaEarnings, 2)}</span>;
                }
                if (row.isMaxBounty && row.maxBountyEarnings) {
                    // maxBountyEarnings is already in USD
                    return <span className="text-rose-400 font-medium">${safeToFixed(row.maxBountyEarnings, 2)}</span>;
                }
                return <span className="text-gray-600">-</span>;
            },
        },
        {
            key: "actualROAS",
            header: (
                <InfoTooltip content={<><strong>ROAS (Return on Ad Spend):</strong><br />Partner Revenue (INR) ÷ Ad Cost<br /><br />• &gt;1.0x = Profitable<br />• &lt;1.0x = Loss<br /><br /><strong>Profit/Loss:</strong><br />Revenue - Cost</>}>
                    <span>ROAS</span>
                </InfoTooltip>
            ) as unknown as string,
            align: "right" as const,
            sortable: true,
            render: (value: number | undefined, row: Campaign & { isKelkoo?: boolean; isAdmedia?: boolean; isMaxBounty?: boolean; profitability?: number }) => {
                if (row.isKelkoo || row.isAdmedia || row.isMaxBounty) {
                    const profit = row.profitability || 0;
                    return (
                        <div className="text-right">
                            <p className={`font-medium ${(value || 0) >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                                {safeToFixed(value || 0, 2)}x
                            </p>
                            <p className={`text-xs ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {profit >= 0 ? "+" : ""}₹{profit.toLocaleString()}
                            </p>
                        </div>
                    );
                }
                return <span className="text-gray-600">-</span>;
            },
        },
        {
            key: "riskLevel",
            header: "Risk",
            align: "center" as const,
            sortable: true,
            render: (value: string | undefined) => {
                const config: Record<string, { bg: string; text: string; icon: string }> = {
                    "Low": { bg: "bg-emerald-500/20", text: "text-emerald-400", icon: "●" },
                    "Medium": { bg: "bg-amber-500/20", text: "text-amber-400", icon: "●" },
                    "High": { bg: "bg-rose-500/20", text: "text-rose-400", icon: "●" },
                };
                const cfg = config[value || "Low"] || { bg: "bg-gray-500/20", text: "text-gray-400", icon: "●" };
                return (
                    <span className={`${cfg.text} text-xs font-medium`} title={value || "Unknown"}>
                        {cfg.icon}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                        <p className="text-gray-400 mt-1">
                            EFF24 Account Performance - <span className="text-gray-300">{new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span> to <span className="text-gray-300">{new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </p>
                    </div>

                    {/* Live Indicator & Campaigns Badge Group - Moved here */}
                    <div className="flex items-center gap-3">
                        {/* Data Source Indicator */}
                        {dataSource === 'live' && (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20 text-cyan-400 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                                Live from Google Ads API
                            </span>
                        )}
                        {dataSource === 'database' && (
                            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 whitespace-nowrap">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                Cached Data
                            </span>
                        )}

                        <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25 whitespace-nowrap">
                            {liveEnrichedCampaigns.length} Campaigns
                        </span>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <DateRangePicker
                        startDate={dateRange.start}
                        endDate={dateRange.end}
                        onChange={(start, end) => setDateRange({ start, end })}
                    />

                    <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
                        {(["overview", "performance", "budget"] as const).map(view => (
                            <button
                                key={view}
                                onClick={() => setSelectedView(view)}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${selectedView === view ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20" : "text-gray-400 hover:text-white hover:bg-gray-700/50"}`}
                            >
                                {view.charAt(0).toUpperCase() + view.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Initial Loading State */}
            {(liveLoading || (isFetchingLive && !liveSummary)) && (
                <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-gray-700 border-t-purple-500 animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full border-4 border-gray-800 border-t-cyan-400 animate-spin-reverse"></div>
                        </div>
                    </div>
                    <p className="mt-6 text-gray-400 font-medium animate-pulse">Loading Dashboard Data...</p>
                </div>
            )}

            {/* Global Syncing Indicator */}
            {(kelkooLoading || admediaLoading || maxBountyLoading || isFetchingLive) && !liveLoading && !(isFetchingLive && !liveSummary) && (
                <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="bg-gray-900/90 backdrop-blur-md border border-purple-500/30 rounded-xl p-4 shadow-2xl flex items-center gap-4 transition-all hover:border-purple-500/50 group">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
                                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 animate-pulse border-2 border-gray-900"></div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">Syncing Performance Data</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                {isFetchingLive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Google Ads</span>}
                                {kelkooLoading && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Kelkoo</span>}
                                {admediaLoading && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Admedia</span>}
                                {maxBountyLoading && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">MaxBounty</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!(liveLoading || (isFetchingLive && !liveSummary)) && (
                <>

                    {/* Fetching Live Data Indicator */}
                    {isFetchingLive && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-900/40 via-gray-900 to-purple-900/40 p-6 border border-cyan-500/30">
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 animate-ping"></div>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-white mb-1">Fetching Historical Data from Google Ads API...</h3>
                                    <p className="text-sm text-gray-400">
                                        No cached data found for this date range. Fetching real-time data directly from Google Ads.
                                        This may take 10-30 seconds for large accounts.
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 text-xs text-cyan-400">
                                        <Activity className="w-4 h-4" />
                                        <span>Live API Fetch</span>
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {dateRange.start} → {dateRange.end}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Google Ads Data Availability Notice - Only show when not loading and no campaigns */}
                    {!liveLoading && !isFetchingLive && liveEnrichedCampaigns.length === 0 && (
                        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-900/30 via-gray-900 to-orange-900/30 p-4 border border-amber-500/30">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm font-semibold text-amber-400 mb-1">
                                        {error ? "Backend Connection Error" : "Google Ads Data Not Available for Selected Period"}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        {error ? (
                                            <>
                                                Failed to connect to the backend API: <span className="text-rose-400 font-mono italic">{error}</span>.
                                                Please Ensure the FastAPI server is running on port 8000.
                                            </>
                                        ) : (
                                            <>
                                                No Google Ads data synced for {new Date(dateRange.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(dateRange.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
                                                Partner network data (Kelkoo, Admedia, MaxBounty) is showing correctly below.
                                            </>
                                        )}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        console.log('Manual refetch triggered for:', dateRange);
                                        refetchLive(true);
                                    }}
                                    disabled={isFetchingLive}
                                    className="px-4 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isFetchingLive ? 'animate-spin' : ''}`} />
                                    {isFetchingLive ? 'Fetching...' : 'Fetch Live Data'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats Bar */}
                    <QuickStatsBar campaigns={liveEnrichedCampaigns as any[]} />

                    {/* View Banner - Shows different content based on selected tab */}
                    <ViewBanner
                        view={selectedView}
                        liveKelkooRevenueInr={liveKelkooAggregates.totalRevenueInr + liveKelkooAggregates.totalSaleValueInr}
                        totals={totals}
                        topPerformers={topPerformers}
                        bottomPerformers={bottomPerformers}
                    />

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
                                    {liveSummary?.summary_text ? (
                                        <span className="text-gray-200">{liveSummary.summary_text}</span>
                                    ) : (
                                        <>
                                            You spent <span className="font-bold text-amber-400">{formatCurrency(totals.cost)}</span> and generated{" "}
                                            <span className="font-bold text-emerald-400">{formatNumber(totals.conversions)} conversions</span> at{" "}
                                            <span className="font-bold text-purple-400">{safeToFixed(avgROAS, 2)}x ROAS</span>.
                                        </>
                                    )}
                                    {" "}
                                    <span className="text-gray-400">
                                        Kelkoo: <span className="text-emerald-400">{liveKelkooAggregates.totalLeads.toLocaleString()}</span> leads
                                        {liveKelkooAggregates.totalSales > 0 && <span> / <span className="text-emerald-300">{liveKelkooAggregates.totalSales}</span> sales</span>}
                                        {" "}(€{liveKelkooAggregates.totalRevenueEur.toLocaleString()}).{" "}

                                        Admedia: <span className="text-amber-400">{liveAdmediaAggregates.totalLeads.toLocaleString()}</span> leads
                                        {liveAdmediaAggregates.totalConversions > 0 && <span> / <span className="text-amber-300">{liveAdmediaAggregates.totalConversions}</span> conv</span>}
                                        {" "}(${liveAdmediaAggregates.totalEarningsUsd.toLocaleString()}).{" "}

                                        MaxBounty: <span className="text-rose-400">{liveMaxBountyAggregates.leads.toLocaleString()}</span> leads
                                        {liveMaxBountyAggregates.sales > 0 && <span> / <span className="text-rose-300">{liveMaxBountyAggregates.sales}</span> sales</span>}
                                        {" "}(${liveMaxBountyAggregates.earnings.toLocaleString()}).
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* AI Metrics Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button
                            onClick={() => setDetailModal({
                                type: "health",
                                title: "Campaign Health Analysis",
                                data: {
                                    score: liveEnrichedCampaigns.reduce((sum, c) => sum + (c.healthScore || 0), 0) / Math.max(liveEnrichedCampaigns.length, 1),
                                    campaigns: liveEnrichedCampaigns.filter(c => (c.healthScore || 0) >= 70).length,
                                    topCampaigns: [...liveEnrichedCampaigns].sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0)).slice(0, 5),
                                }
                            })}
                            className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-xl border border-purple-500/30 p-4 text-left hover:border-purple-400/50 transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-purple-400 font-medium">Avg Health Score</span>
                                <Activity className="w-5 h-5 text-purple-400" />
                            </div>
                            <p className="text-2xl font-bold text-white">{Math.round(liveEnrichedCampaigns.reduce((sum, c) => sum + (c.healthScore || 0), 0) / Math.max(liveEnrichedCampaigns.length, 1))}</p>
                            <p className="text-xs text-gray-500 mt-1">Out of 100</p>
                        </button>
                        <button
                            onClick={() => setDetailModal({
                                type: "performers",
                                title: "High Performing Campaigns",
                                data: {
                                    count: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "A" || c.efficiencyRating === "B").length,
                                    campaigns: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "A" || c.efficiencyRating === "B"),
                                }
                            })}
                            className="bg-gradient-to-br from-emerald-900/30 to-emerald-900/10 rounded-xl border border-emerald-500/30 p-4 text-left hover:border-emerald-400/50 transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-emerald-400 font-medium">High Performers</span>
                                <Star className="w-5 h-5 text-emerald-400" />
                            </div>
                            <p className="text-2xl font-bold text-emerald-400">{liveEnrichedCampaigns.filter(c => c.efficiencyRating === "A" || c.efficiencyRating === "B").length}</p>
                            <p className="text-xs text-gray-500 mt-1">A/B Rated Campaigns</p>
                        </button>
                        <button
                            onClick={() => setDetailModal({
                                type: "attention",
                                title: "Campaigns Needing Attention",
                                data: {
                                    count: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "C" || c.efficiencyRating === "D").length,
                                    campaigns: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "C" || c.efficiencyRating === "D"),
                                }
                            })}
                            className="bg-gradient-to-br from-amber-900/30 to-amber-900/10 rounded-xl border border-amber-500/30 p-4 text-left hover:border-amber-400/50 transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-amber-400 font-medium">Needs Attention</span>
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <p className="text-2xl font-bold text-amber-400">{liveEnrichedCampaigns.filter(c => c.efficiencyRating === "C" || c.efficiencyRating === "D").length}</p>
                            <p className="text-xs text-gray-500 mt-1">Medium Risk</p>
                        </button>
                        <button
                            onClick={() => setDetailModal({
                                type: "risk",
                                title: "At Risk Campaigns",
                                data: {
                                    count: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "F").length,
                                    campaigns: liveEnrichedCampaigns.filter(c => c.efficiencyRating === "F"),
                                }
                            })}
                            className="bg-gradient-to-br from-rose-900/30 to-rose-900/10 rounded-xl border border-rose-500/30 p-4 text-left hover:border-rose-400/50 transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-rose-400 font-medium">At Risk</span>
                                <AlertCircle className="w-5 h-5 text-rose-400" />
                            </div>
                            <p className="text-2xl font-bold text-rose-400">{liveEnrichedCampaigns.filter(c => c.efficiencyRating === "F").length}</p>
                            <p className="text-xs text-gray-500 mt-1">High Risk Campaigns</p>
                        </button>
                    </div>

                    {/* Data Source Summary (Kelkoo + Admedia + MaxBounty) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Kelkoo Summary - Now with LIVE API data */}
                        <div className="bg-gradient-to-br from-cyan-900/20 to-purple-900/20 rounded-xl border border-cyan-500/20 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="px-2 py-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded text-xs font-bold text-white">KL</div>
                                <h3 className="text-lg font-semibold text-white">Kelkoo ({dateRangeLabel})</h3>
                                {kelkooLoading ? (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">Loading...</span>
                                ) : kelkooIsFallback ? (
                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        refetchKelkoo();
                                    }}
                                    disabled={kelkooLoading}
                                    className="ml-auto p-1.5 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
                                    title="Refresh Kelkoo data"
                                >
                                    <RefreshCw className={`w-4 h-4 text-cyan-400 ${kelkooLoading ? 'animate-spin' : ''}`} />
                                </button>
                                {kelkooError && <span className="text-xs text-red-400">{kelkooError}</span>}
                            </div>
                            <div
                                className="grid grid-cols-3 gap-4 cursor-pointer hover:bg-cyan-900/10 rounded-lg p-2 -m-2 transition-colors"
                                onClick={() => setDetailModal({
                                    type: "kelkoo",
                                    title: "Kelkoo Performance Details",
                                    data: {
                                        leads: liveKelkooAggregates.totalLeads,
                                        revenue: liveKelkooAggregates.totalRevenueEur,
                                        revenueInr: liveKelkooAggregates.totalRevenueInr,
                                        sales: liveKelkooAggregates.totalSales,
                                        saleValue: liveKelkooAggregates.totalSaleValueEur,
                                        saleValueInr: liveKelkooAggregates.totalSaleValueInr,
                                        conversionRate: liveKelkooAggregates.conversionRate,
                                        revenuePerLead: liveKelkooAggregates.vpl,
                                        isLive: !kelkooIsFallback,
                                        campaigns: liveEnrichedCampaigns.filter(c => c.isKelkoo),
                                    }
                                })}
                            >
                                <div>
                                    <p className="text-xs text-gray-500">Leads</p>
                                    <p className="text-xl font-bold text-cyan-400">
                                        {liveKelkooAggregates.totalLeads.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Revenue</p>
                                    <p className="text-lg font-bold text-emerald-400">
                                        €{liveKelkooAggregates.totalRevenueEur.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-emerald-300/70">
                                        ₹{liveKelkooAggregates.totalRevenueInr.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Sales</p>
                                    <p className="text-xl font-bold text-purple-400">
                                        {liveKelkooAggregates.totalSales}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Sale Value</p>
                                    <p className="text-base font-semibold text-white">
                                        €{liveKelkooAggregates.totalSaleValueEur.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        ₹{liveKelkooAggregates.totalSaleValueInr.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Conv. Rate</p>
                                    <p className="text-base font-semibold text-white">
                                        {safeToFixed(liveKelkooAggregates.conversionRate, 2)}%
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Value/Lead</p>
                                    <p className="text-base font-semibold text-white">
                                        €{safeToFixed(liveKelkooAggregates.vpl, 2)}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        ₹{safeToFixed(liveKelkooAggregates.vpl * 89.5, 2)}
                                    </p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">Click metrics for detailed breakdown</p>
                        </div>

                        {/* Admedia Summary */}
                        <div className="bg-gradient-to-br from-amber-900/20 to-orange-900/20 rounded-xl border border-amber-500/20 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded text-xs font-bold text-white">AM</div>
                                <h3 className="text-lg font-semibold text-white">Admedia ({dateRangeLabel})</h3>
                                {admediaLoading ? (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">Loading...</span>
                                ) : admediaIsFallback ? (
                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        refetchAdmedia();
                                    }}
                                    disabled={admediaLoading}
                                    className="ml-auto p-1.5 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                                    title="Refresh Admedia data"
                                >
                                    <RefreshCw className={`w-4 h-4 text-amber-400 ${admediaLoading ? 'animate-spin' : ''}`} />
                                </button>
                                {admediaError && <span className="text-xs text-red-400">{admediaError}</span>}
                            </div>
                            <div
                                className="grid grid-cols-3 gap-4 cursor-pointer hover:bg-amber-900/10 rounded-lg p-2 -m-2 transition-colors"
                                onClick={() => setDetailModal({
                                    type: "admedia",
                                    title: "Admedia Performance Details",
                                    data: {
                                        leads: liveAdmediaAggregates.totalLeads,
                                        conversions: liveAdmediaAggregates.totalConversions,
                                        earningsUsd: liveAdmediaAggregates.totalEarningsUsd,
                                        earningsInr: liveAdmediaAggregates.totalEarningsInr,
                                        conversionRate: liveAdmediaAggregates.conversionRate,
                                        cpc: liveAdmediaAggregates.cpc,
                                        cpl: liveAdmediaAggregates.cpl,
                                        isLive: !admediaIsFallback,
                                        campaigns: liveEnrichedCampaigns.filter(c => c.isAdmedia),
                                    }
                                })}
                            >
                                <div>
                                    <p className="text-xs text-gray-500">Leads</p>
                                    <p className="text-xl font-bold text-amber-400">{liveAdmediaAggregates.totalLeads.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Conversions</p>
                                    <p className="text-xl font-bold text-emerald-400">{liveAdmediaAggregates.totalConversions.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Conv Rate</p>
                                    <p className="text-xl font-bold text-purple-400">{safeToFixed(liveAdmediaAggregates.conversionRate, 1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Earnings</p>
                                    <p className="text-base font-semibold text-emerald-400">${liveAdmediaAggregates.totalEarningsUsd.toLocaleString()}</p>
                                    <p className="text-xs text-emerald-300/70">₹{liveAdmediaAggregates.totalEarningsInr.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">CPC</p>
                                    <p className="text-base font-semibold text-white">${safeToFixed(liveAdmediaAggregates.cpc, 2)}</p>
                                    <p className="text-xs text-gray-400">₹{safeToFixed(liveAdmediaAggregates.cpc * 83.5, 2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">CPL</p>
                                    <p className="text-base font-semibold text-white">${safeToFixed(liveAdmediaAggregates.cpl, 2)}</p>
                                    <p className="text-xs text-gray-400">₹{safeToFixed(liveAdmediaAggregates.cpl * 83.5, 2)}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">Click metrics for detailed breakdown</p>
                        </div>

                        {/* MaxBounty Summary - LIVE API data */}
                        <div className="bg-gradient-to-br from-rose-900/20 to-red-900/20 rounded-xl border border-rose-500/20 p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="px-2 py-1 bg-gradient-to-r from-rose-500 to-red-500 rounded text-xs font-bold text-white">MB</div>
                                <h3 className="text-lg font-semibold text-white">MaxBounty ({dateRangeLabel})</h3>
                                {maxBountyLoading ? (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full animate-pulse">Loading...</span>
                                ) : maxBountyIsFallback ? (
                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached</span>
                                ) : (
                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live</span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        refetchMaxBounty();
                                    }}
                                    disabled={maxBountyLoading}
                                    className="ml-auto p-1.5 rounded-lg hover:bg-rose-500/20 transition-colors disabled:opacity-50"
                                    title="Refresh MaxBounty data"
                                >
                                    <RefreshCw className={`w-4 h-4 text-rose-400 ${maxBountyLoading ? 'animate-spin' : ''}`} />
                                </button>
                                {maxBountyError && <span className="text-xs text-red-400" title={maxBountyError}>Network error</span>}
                            </div>
                            <div
                                className="grid grid-cols-3 gap-4 cursor-pointer hover:bg-rose-900/10 rounded-lg p-2 -m-2 transition-colors"
                                onClick={() => setDetailModal({
                                    type: "maxbounty",
                                    title: "MaxBounty Performance Details",
                                    data: {
                                        clicks: liveMaxBountyAggregates.clicks,
                                        leads: liveMaxBountyAggregates.leads,
                                        earnings: liveMaxBountyAggregates.earnings,
                                        earningsInr: liveMaxBountyAggregates.earningsInr,
                                        conversion: liveMaxBountyAggregates.conversion,
                                        epc: liveMaxBountyAggregates.epc,
                                        sales: liveMaxBountyAggregates.sales,
                                        isLive: !maxBountyIsFallback,
                                        campaigns: maxBountyCampaigns,
                                    }
                                })}
                            >
                                <div>
                                    <p className="text-xs text-gray-500">Clicks</p>
                                    <p className="text-xl font-bold text-rose-400">{liveMaxBountyAggregates.clicks.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Leads</p>
                                    <p className="text-xl font-bold text-emerald-400">{liveMaxBountyAggregates.leads.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Conv Rate</p>
                                    <p className="text-xl font-bold text-purple-400">{safeToFixed(liveMaxBountyAggregates.conversion, 1)}%</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Earnings</p>
                                    <p className="text-base font-semibold text-emerald-400">${liveMaxBountyAggregates.earnings.toLocaleString()}</p>
                                    <p className="text-xs text-emerald-300/70">₹{liveMaxBountyAggregates.earningsInr.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">EPC</p>
                                    <p className="text-base font-semibold text-white">${safeToFixed(liveMaxBountyAggregates.epc, 2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Sales Value</p>
                                    <p className="text-base font-semibold text-white">${liveMaxBountyAggregates.sales.toLocaleString()}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">Click metrics for detailed breakdown</p>
                        </div>
                    </div>

                    {/* Primary KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
                        <EnhancedKPICard
                            title="Total Clicks"
                            value={liveSummary ? formatNumber(liveSummary.clicks.value) : formatNumber(totals.clicks)}
                            subtitle={liveSummary ? `${formatNumber(liveSummary.impressions.value)} impr.` : `${formatNumber(totals.impressions)} impr.`}
                            trend={liveSummary?.clicks.change_percent ? `${safeToFixed(liveSummary.clicks.change_percent, 1)}%` : "+8.2%"}
                            trendUp={liveSummary?.clicks.change_direction === "up"}
                            icon={<ClicksIcon />}
                            color="primary"
                            sparkData={liveTrends.length > 0 ? liveTrends.find(t => t.metric === "clicks")?.data.map(d => d.value) : clicksSparkData}
                            onClick={() => setSelectedMetric("clicks")}
                        />
                        <EnhancedKPICard
                            title="Total Cost"
                            value={liveSummary ? formatCurrency(liveSummary.cost.value) : formatCurrency(totals.cost)}
                            subtitle={liveSummary ? `Rs.${safeToFixed(liveSummary.cpc.value, 0)} avg CPC` : `Rs.${safeToFixed(totals.avgCpc, 0)} avg CPC`}
                            trend={liveSummary?.cost.change_percent ? `${safeToFixed(liveSummary.cost.change_percent, 1)}%` : "-2.4%"}
                            trendUp={liveSummary?.cost.change_direction === "down"}
                            icon={<CostIcon />}
                            color="warning"
                            sparkData={liveTrends.length > 0 ? liveTrends.find(t => t.metric === "cost")?.data.map(d => d.value) : costSparkData}
                            onClick={() => setSelectedMetric("cost")}
                        />
                        <EnhancedKPICard
                            title="Conversions"
                            value={liveSummary ? formatNumber(liveSummary.conversions.value) : formatNumber(totals.conversions)}
                            subtitle={liveSummary ? `${safeToFixed(liveSummary.conversions.value / liveSummary.clicks.value * 100, 1)}% rate` : `${safeToFixed(conversionRate, 1)}% rate`}
                            trend={liveSummary?.conversions.change_percent ? `${safeToFixed(liveSummary.conversions.change_percent, 1)}%` : "+15.3%"}
                            trendUp={liveSummary?.conversions.change_direction === "up"}
                            icon={<ConversionsIcon />}
                            color="success"
                            sparkData={liveTrends.length > 0 ? liveTrends.find(t => t.metric === "conversions")?.data.map(d => d.value) : convSparkData}
                            onClick={() => setSelectedMetric("conversions")}
                        />
                        <EnhancedKPICard
                            title="CTR"
                            value={liveSummary ? `${safeToFixed(liveSummary.ctr.value, 2)}%` : `${safeToFixed(totals.ctr, 2)}%`}
                            subtitle="Above avg"
                            trend={liveSummary?.ctr.change_percent ? `${safeToFixed(liveSummary.ctr.change_percent, 1)}%` : "+0.5%"}
                            trendUp={liveSummary?.ctr.change_direction === "up"}
                            icon={<CTRIcon />}
                            color="cyan"
                            sparkData={ctrSparkData}
                            onClick={() => setActiveKPI("ctr")}
                        />
                        <EnhancedKPICard
                            title="Avg CPC"
                            value={liveSummary ? `Rs.${safeToFixed(liveSummary.cpc.value, 0)}` : `Rs.${safeToFixed(totals.avgCpc, 0)}`}
                            subtitle="Per click"
                            trend={liveSummary?.cpc.change_percent ? `${safeToFixed(liveSummary.cpc.change_percent, 1)}%` : "-1.2%"}
                            trendUp={liveSummary?.cpc.change_direction === "down"}
                            icon={<CPCIcon />}
                            color="warning"
                            onClick={() => setActiveKPI("cpc")}
                        />
                        <EnhancedKPICard
                            title="CPA"
                            value={liveSummary ? `Rs.${safeToFixed(liveSummary.cpa.value, 0)}` : `Rs.${safeToFixed(totals.cost / totals.conversions, 0)}`}
                            subtitle="Per conversion"
                            trend={liveSummary?.cpa.change_percent ? `${safeToFixed(liveSummary.cpa.change_percent, 1)}%` : "-3.5%"}
                            trendUp={liveSummary?.cpa.change_direction === "down"}
                            icon={<ConversionsIcon />}
                            color="danger"
                            onClick={() => setActiveKPI("cpa")}
                        />
                        <EnhancedKPICard
                            title="ROAS"
                            value={liveSummary ? `${safeToFixed(liveSummary.roas.value, 2)}x` : `${safeToFixed(avgROAS, 2)}x`}
                            subtitle="Return on ad spend"
                            trend={liveSummary?.roas.change_percent ? `${safeToFixed(liveSummary.roas.change_percent, 1)}%` : "+5.2%"}
                            trendUp={liveSummary?.roas.change_direction === "up"}
                            icon={<ROASIcon />}
                            color="success"
                            onClick={() => setActiveKPI("roas")}
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
                                {accountData.map((acc, i) => (
                                    <div key={acc.name} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${i === 0 ? "bg-purple-500" : i === 1 ? "bg-cyan-500" : "bg-emerald-500"}`} />
                                            <span className="text-gray-300">{acc.name}</span>
                                        </div>
                                        <span className="font-medium text-white">{formatCurrency(acc.value)}</span>
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
                                            <p className="text-xs text-gray-500">{safeToFixed(camp.conversions, 0)} conv @ Rs.{safeToFixed(camp.cpa, 0)} CPA</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-400">{safeToFixed(camp.roas, 2)}x</p>
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
                                    <div key={acc.name} className="p-4 rounded-xl bg-gray-800/30 border border-gray-700/50 hover:border-gray-600 transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${i === 0 ? "bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/30" :
                                                    i === 1 ? "bg-gradient-to-br from-cyan-500 to-cyan-600 shadow-lg shadow-cyan-500/30" :
                                                        "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30"
                                                    }`}>
                                                    {acc.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">{acc.name}</p>
                                                    {/* <p className="text-xs text-gray-500">{acc.campaigns} campaigns</p> */}
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
                                                <p className="font-medium text-white">Rs.{safeToFixed(acc.cost / acc.conversions, 0)}</p>
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
                    <div className="space-y-6">
                        {/* Network Filters & Comparison - Inline with Table */}
                        <div className="relative z-10 flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-gray-900/80 rounded-2xl p-4 border border-gray-700/50 backdrop-blur-sm">
                            {/* Network Filter Buttons */}
                            <div className="flex items-center gap-2 bg-gray-800/70 rounded-xl p-3 border border-gray-600/50">
                                <span className="text-xs text-gray-500 mr-2">Network:</span>
                                {([
                                    { key: "all", label: "All", color: "bg-gray-600", count: liveEnrichedCampaigns.length },
                                    { key: "kelkoo", label: "Kelkoo", color: "bg-gradient-to-r from-purple-500 to-cyan-500", count: liveEnrichedCampaigns.filter(c => detectNetwork(c.name).isKelkoo).length },
                                    { key: "admedia", label: "Admedia", color: "bg-gradient-to-r from-amber-500 to-orange-500", count: liveEnrichedCampaigns.filter(c => detectNetwork(c.name).isAdmedia).length },
                                    { key: "maxbounty", label: "MaxBounty", color: "bg-gradient-to-r from-rose-500 to-red-500", count: liveEnrichedCampaigns.filter(c => detectNetwork(c.name).isMaxBounty).length },
                                ] as const).map(({ key, label, color, count }) => (
                                    <button
                                        key={key}
                                        onClick={() => setNetworkFilter(key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${networkFilter === key
                                            ? `${color} text-white shadow-lg`
                                            : "bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white"
                                            }`}
                                    >
                                        {label}
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${networkFilter === key ? "bg-white/20" : "bg-gray-600"}`}>{count}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Network ROAS Comparison */}
                            <div className="flex gap-3 flex-wrap">
                                <div className={`px-4 py-2.5 rounded-xl border cursor-pointer transition-all shadow-lg ${networkFilter === "kelkoo" ? "bg-purple-500/30 border-purple-500/60 shadow-purple-500/20" : "bg-gray-800/50 border-gray-600/50 hover:border-purple-500/40 hover:bg-gray-800/70"}`} onClick={() => setNetworkFilter(networkFilter === "kelkoo" ? "all" : "kelkoo")}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-white">KL</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-base font-bold ${networkComparison.kelkoo.roas >= 1 ? "text-emerald-400" : "text-red-400"}`}>{safeToFixed(networkComparison.kelkoo.roas, 2)}x</p>
                                            <p className="text-[10px] text-gray-400">₹{safeToFixed(networkComparison.kelkoo.revenueInr / 1000, 0)}k rev</p>
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-4 py-2.5 rounded-xl border cursor-pointer transition-all shadow-lg ${networkFilter === "admedia" ? "bg-amber-500/30 border-amber-500/60 shadow-amber-500/20" : "bg-gray-800/50 border-gray-600/50 hover:border-amber-500/40 hover:bg-gray-800/70"}`} onClick={() => setNetworkFilter(networkFilter === "admedia" ? "all" : "admedia")}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-white">AM</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-base font-bold ${networkComparison.admedia.roas >= 1 ? "text-emerald-400" : "text-red-400"}`}>{safeToFixed(networkComparison.admedia.roas, 2)}x</p>
                                            <p className="text-[10px] text-gray-400">₹{safeToFixed(networkComparison.admedia.revenueInr / 1000, 0)}k rev</p>
                                        </div>
                                    </div>
                                </div>
                                <div className={`px-4 py-2.5 rounded-xl border cursor-pointer transition-all shadow-lg ${networkFilter === "maxbounty" ? "bg-rose-500/30 border-rose-500/60 shadow-rose-500/20" : "bg-gray-800/50 border-gray-600/50 hover:border-rose-500/40 hover:bg-gray-800/70"}`} onClick={() => setNetworkFilter(networkFilter === "maxbounty" ? "all" : "maxbounty")}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-white">MB</span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-base font-bold ${networkComparison.maxbounty.roas >= 1 ? "text-emerald-400" : "text-red-400"}`}>{safeToFixed(networkComparison.maxbounty.roas, 2)}x</p>
                                            <p className="text-[10px] text-gray-400">₹{safeToFixed(networkComparison.maxbounty.revenueInr / 1000, 0)}k rev</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="relative z-0">
                            <DataTable
                                data={filteredCampaigns}
                                columns={campaignColumns}
                                title={`${networkFilter === "all" ? "All" : networkFilter.charAt(0).toUpperCase() + networkFilter.slice(1)} Campaigns (${filteredCampaigns.length}${kelkooLoading || admediaLoading || maxBountyLoading ? " - loading..." : ""})`}
                                searchKeys={["name", "account"]}
                                pageSize={10}
                            />
                        </div>
                    </div>

                    {/* Campaign Modal */}
                    <CampaignModal campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />

                    {/* KPI Analytics Modal */}
                    {activeKPI && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setActiveKPI(null)}>
                            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                                    <h2 className="text-xl font-display font-bold text-white">
                                        {activeKPI === "ctr" && "Click-Through Rate Analysis"}
                                        {activeKPI === "cpc" && "Cost Per Click Analysis"}
                                        {activeKPI === "cpa" && "Cost Per Acquisition Analysis"}
                                        {activeKPI === "roas" && "Return on Ad Spend Analysis"}
                                    </h2>
                                    <button onClick={() => setActiveKPI(null)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="p-6">
                                    <div className="text-center mb-6">
                                        <p className="text-5xl font-display font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                                            {activeKPI === "ctr" && `${safeToFixed(totals.ctr, 2)}%`}
                                            {activeKPI === "cpc" && `Rs.${safeToFixed(totals.avgCpc, 0)}`}
                                            {activeKPI === "cpa" && `Rs.${safeToFixed(totals.cost / totals.conversions, 0)}`}
                                            {activeKPI === "roas" && `${safeToFixed(avgROAS, 2)}x`}
                                        </p>
                                    </div>
                                    <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
                                        <h3 className="text-sm font-semibold text-white mb-3">Key Insights</h3>
                                        <ul className="space-y-2 text-sm text-gray-300">
                                            {activeKPI === "ctr" && (
                                                <>
                                                    <li>- Average CTR of {safeToFixed(totals.ctr, 2)}% is above industry average</li>
                                                    <li>- Best performer: {topPerformers[0]?.name} at {safeToFixed(topPerformers[0]?.ctr, 2)}%</li>
                                                    <li>- {liveEnrichedCampaigns.filter(c => c.ctr > 5).length} campaigns have CTR above 5%</li>
                                                </>
                                            )}
                                            {activeKPI === "cpc" && (
                                                <>
                                                    <li>- Average CPC of Rs.{safeToFixed(totals.avgCpc, 0)} across {liveEnrichedCampaigns.length} campaigns</li>
                                                    <li>- Total clicks: {totals.clicks.toLocaleString()}</li>
                                                    <li>- Consider bid adjustments for high CPC campaigns</li>
                                                </>
                                            )}
                                            {activeKPI === "cpa" && (
                                                <>
                                                    <li>- Average CPA: Rs.{safeToFixed(totals.cost / totals.conversions, 0)} per conversion</li>
                                                    <li>- Total conversions: {totals.conversions.toLocaleString()}</li>
                                                    <li>- {liveEnrichedCampaigns.filter(c => c.conversionRate > 50).length} high-converting campaigns</li>
                                                </>
                                            )}
                                            {activeKPI === "roas" && (
                                                <>
                                                    <li>- Average ROAS: {safeToFixed(avgROAS, 2)}x return on ad spend</li>
                                                    <li>- {liveEnrichedCampaigns.filter(c => c.conversions > 200).length} campaigns with 200+ conversions</li>
                                                    <li>- Total ad spend: {formatCurrency(totals.cost)}</li>
                                                </>
                                            )}
                                        </ul>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white mb-3">Top 5 Campaigns</h3>
                                        <div className="space-y-2">
                                            {topPerformers.slice(0, 5).map((camp, i) => (
                                                <div key={camp.id} className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                    <span className="text-sm text-gray-300 flex-1 truncate">{camp.name}</span>
                                                    <span className="text-sm font-medium text-white">
                                                        {activeKPI === "ctr" ? `${safeToFixed(camp.ctr, 2)}%` :
                                                            activeKPI === "cpc" ? `Rs.${safeToFixed(camp.avgCpc, 0)}` :
                                                                activeKPI === "cpa" ? `Rs.${safeToFixed(camp.cost / Math.max(camp.conversions, 1), 0)}` :
                                                                    `${safeToFixed(camp.conversions * 175 / camp.cost, 2)}x`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detail Modal for expanded views */}
                    {detailModal && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailModal(null)}>
                            <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                                <div className="p-6 border-b border-gray-700 flex items-center justify-between">
                                    <h2 className="text-xl font-display font-bold text-white">{detailModal.title}</h2>
                                    <button onClick={() => setDetailModal(null)} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="p-6">
                                    {detailModal.type === "kelkoo" && (
                                        <>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="px-2 py-1 bg-gradient-to-r from-purple-500 to-cyan-500 rounded text-xs font-bold text-white">KL</span>
                                                {(detailModal.data.isLive as boolean) ? (
                                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live API Data</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached Data</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Total Leads</p>
                                                    <p className="text-2xl font-bold text-cyan-400">{(detailModal.data.leads as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Lead Revenue (EUR)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">€{(detailModal.data.revenue as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Lead Revenue (INR)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">Rs.{Math.round(detailModal.data.revenueInr as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Sales</p>
                                                    <p className="text-2xl font-bold text-purple-400">{(detailModal.data.sales as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Sale Value (EUR)</p>
                                                    <p className="text-2xl font-bold text-white">€{(detailModal.data.saleValue as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Sale Value (INR)</p>
                                                    <p className="text-2xl font-bold text-white">Rs.{Math.round(detailModal.data.saleValueInr as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Conversion Rate</p>
                                                    <p className="text-2xl font-bold text-amber-400">{safeToFixed(detailModal.data.conversionRate as number, 2)}%</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Value Per Lead</p>
                                                    <p className="text-2xl font-bold text-white">€{safeToFixed(detailModal.data.revenuePerLead as number, 2)}</p>
                                                </div>
                                            </div>

                                            <h3 className="text-sm font-semibold text-white mb-3">KL Campaigns Performance</h3>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {(detailModal.data.campaigns as Campaign[]).map((camp, i) => (
                                                    <div key={camp.id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                            <p className="text-xs text-gray-500">Cost: {formatCurrency(camp.cost)} | Clicks: {camp.clicks.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-cyan-400">{camp.kelkooLeads || 0} leads</p>
                                                            <p className="text-xs text-emerald-400">Rs.{(camp.kelkooRevenueInr || 0).toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-sm font-bold ${(camp.actualROAS || 0) >= 1 ? "text-emerald-400" : "text-red-400"}`}>
                                                                {safeToFixed(camp.actualROAS || 0, 2)}x
                                                            </p>
                                                            <p className={`text-xs ${(camp.profitability || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                                Rs.{(camp.profitability || 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
                                                <button
                                                    onClick={() => refetchKelkoo()}
                                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Refresh Kelkoo Data
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "admedia" && (
                                        <>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded text-xs font-bold text-white">AM</span>
                                                {(detailModal.data.isLive as boolean) ? (
                                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live API Data</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached Data</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Total Leads</p>
                                                    <p className="text-2xl font-bold text-amber-400">{(detailModal.data.leads as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Conversions</p>
                                                    <p className="text-2xl font-bold text-emerald-400">{(detailModal.data.conversions as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Earnings (USD)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">${(detailModal.data.earningsUsd as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Earnings (INR)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">₹{Math.round(detailModal.data.earningsInr as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Conv. Rate</p>
                                                    <p className="text-2xl font-bold text-purple-400">{safeToFixed(detailModal.data.conversionRate as number, 1)}%</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">CPC</p>
                                                    <p className="text-2xl font-bold text-white">${safeToFixed(detailModal.data.cpc as number, 2)}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">CPL</p>
                                                    <p className="text-2xl font-bold text-white">${safeToFixed(detailModal.data.cpl as number, 2)}</p>
                                                </div>
                                            </div>

                                            <h3 className="text-sm font-semibold text-white mb-3">AM Campaigns Performance</h3>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {(detailModal.data.campaigns as Campaign[]).map((camp, i) => (
                                                    <div key={camp.id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                            <p className="text-xs text-gray-500">Cost: {formatCurrency(camp.cost)} | Clicks: {camp.clicks.toLocaleString()}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-amber-400">{camp.admediaLeads || 0} leads</p>
                                                            <p className="text-xs text-emerald-400">₹{(camp.admediaEarningsInr || 0).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
                                                <button
                                                    onClick={() => refetchAdmedia()}
                                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Refresh Admedia Data
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "maxbounty" && (
                                        <>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="px-2 py-1 bg-gradient-to-r from-rose-500 to-red-500 rounded text-xs font-bold text-white">MB</span>
                                                {(detailModal.data.isLive as boolean) ? (
                                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Live API Data</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">Cached Data</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Total Clicks</p>
                                                    <p className="text-2xl font-bold text-rose-400">{(detailModal.data.clicks as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Leads</p>
                                                    <p className="text-2xl font-bold text-emerald-400">{(detailModal.data.leads as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Earnings (USD)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">${(detailModal.data.earnings as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Earnings (INR)</p>
                                                    <p className="text-2xl font-bold text-emerald-400">₹{Math.round(detailModal.data.earningsInr as number).toLocaleString()}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Conv. Rate</p>
                                                    <p className="text-2xl font-bold text-purple-400">{safeToFixed(detailModal.data.conversion as number, 1)}%</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">EPC</p>
                                                    <p className="text-2xl font-bold text-white">${safeToFixed(detailModal.data.epc as number, 2)}</p>
                                                </div>
                                                <div className="bg-gray-800/50 rounded-xl p-4">
                                                    <p className="text-xs text-gray-500">Sales Value</p>
                                                    <p className="text-2xl font-bold text-white">${(detailModal.data.sales as number).toLocaleString()}</p>
                                                </div>
                                            </div>

                                            <h3 className="text-sm font-semibold text-white mb-3">MaxBounty Campaigns Performance</h3>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {(detailModal.data.campaigns as { name: string; campaign_id: number; clicks: number; leads: number; earnings: number; conversion: number; epc: number; sales: number }[]).map((camp, i) => (
                                                    <div key={camp.campaign_id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                            <p className="text-xs text-gray-500">Clicks: {camp.clicks.toLocaleString()} | Conv: {safeToFixed(camp.conversion, 1)}%</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-sm font-medium text-rose-400">{camp.leads} leads</p>
                                                            <p className="text-xs text-emerald-400">${camp.earnings.toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end">
                                                <button
                                                    onClick={() => refetchMaxBounty()}
                                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                    Refresh MaxBounty Data
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "health" && (
                                        <>
                                            <div className="text-center mb-6">
                                                <p className="text-5xl font-bold text-purple-400">{detailModal.data.score as number}</p>
                                                <p className="text-sm text-gray-400 mt-1">Average Health Score</p>
                                            </div>
                                            <div className="bg-gray-800/50 rounded-xl p-4 mb-4">
                                                <p className="text-sm text-gray-400">
                                                    <span className="text-emerald-400 font-semibold">{detailModal.data.campaigns as number}</span> campaigns have health scores above 70
                                                </p>
                                            </div>
                                            <h3 className="text-sm font-semibold text-white mb-3">Top Healthy Campaigns</h3>
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                                {(detailModal.data.topCampaigns as Campaign[]).map((camp, i) => (
                                                    <div key={camp.id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${(camp.healthScore || 0) >= 70 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                                                            {camp.healthScore || 0}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "performers" && (
                                        <>
                                            <div className="text-center mb-6">
                                                <p className="text-5xl font-bold text-emerald-400">{detailModal.data.count as number}</p>
                                                <p className="text-sm text-gray-400 mt-1">High Performing Campaigns (A/B Rated)</p>
                                            </div>
                                            <h3 className="text-sm font-semibold text-white mb-3">A/B Rated Campaigns</h3>
                                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                                {(detailModal.data.campaigns as Campaign[]).map((camp, i) => (
                                                    <div key={camp.id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                            <p className="text-xs text-gray-500">CTR: {safeToFixed(camp.ctr, 2)}% | Conv: {safeToFixed(camp.conversionRate, 1)}%</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${camp.efficiencyRating === "A" ? "bg-emerald-500/20 text-emerald-400" : "bg-cyan-500/20 text-cyan-400"}`}>
                                                            {camp.efficiencyRating}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "attention" && (
                                        <>
                                            <div className="text-center mb-6">
                                                <p className="text-5xl font-bold text-amber-400">{detailModal.data.count as number}</p>
                                                <p className="text-sm text-gray-400 mt-1">Campaigns Needing Attention (C/D Rated)</p>
                                            </div>
                                            <h3 className="text-sm font-semibold text-white mb-3">C/D Rated Campaigns</h3>
                                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                                {(detailModal.data.campaigns as Campaign[]).map((camp, i) => (
                                                    <div key={camp.id} className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                                                        <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                            <p className="text-xs text-gray-500">CTR: {safeToFixed(camp.ctr, 2)}% | Conv: {safeToFixed(camp.conversionRate, 1)}%</p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${camp.efficiencyRating === "C" ? "bg-amber-500/20 text-amber-400" : "bg-orange-500/20 text-orange-400"}`}>
                                                            {camp.efficiencyRating}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {detailModal.type === "risk" && (
                                        <>
                                            <div className="text-center mb-6">
                                                <p className="text-5xl font-bold text-rose-400">{detailModal.data.count as number}</p>
                                                <p className="text-sm text-gray-400 mt-1">At Risk Campaigns (F Rated)</p>
                                            </div>
                                            <h3 className="text-sm font-semibold text-white mb-3">F Rated Campaigns - Immediate Action Required</h3>
                                            <div className="space-y-2 max-h-[350px] overflow-y-auto">
                                                {(detailModal.data.campaigns as Campaign[]).length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500">
                                                        <p>🎉 No campaigns at risk!</p>
                                                        <p className="text-xs mt-1">All campaigns are performing well</p>
                                                    </div>
                                                ) : (
                                                    (detailModal.data.campaigns as Campaign[]).map((camp, i) => (
                                                        <div key={camp.id} className="flex items-center gap-3 p-3 bg-rose-900/20 rounded-lg border border-rose-500/20">
                                                            <span className="text-xs text-gray-500 w-6">{i + 1}</span>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-white truncate">{camp.name}</p>
                                                                <p className="text-xs text-gray-500">CTR: {safeToFixed(camp.ctr, 2)}% | Conv: {safeToFixed(camp.conversionRate, 1)}%</p>
                                                            </div>
                                                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400">
                                                                F
                                                            </span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                </>
            )}

            {/* Command Palette */}
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                onExport={handleExport}
                onRefresh={handleRefresh}
                onSearch={handleFocusSearch}
                onSwitchMetric={handleSwitchMetric}
            />
        </div>
    );
}
