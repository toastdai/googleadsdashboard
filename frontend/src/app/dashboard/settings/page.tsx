"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { RefreshCw } from "lucide-react";

interface NotificationChannel {
    id: string;
    type: "EMAIL" | "SLACK" | "WEBHOOK";
    name: string;
    config: Record<string, string>;
    enabled: boolean;
}

interface AlertSetting {
    metric: string;
    enabled: boolean;
    warning_threshold: number;
    critical_threshold: number;
}

export default function SettingsPage() {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [syncDays, setSyncDays] = useState(30);

    const [channels, setChannels] = useState<NotificationChannel[]>([
        { id: "1", type: "EMAIL", name: "Primary Email", config: { email: user?.email || "user@example.com" }, enabled: true },
    ]);

    const [alertSettings, setAlertSettings] = useState<AlertSetting[]>([
        { metric: "cost", enabled: true, warning_threshold: 30, critical_threshold: 50 },
        { metric: "conversions", enabled: true, warning_threshold: 25, critical_threshold: 40 },
        { metric: "ctr", enabled: true, warning_threshold: 20, critical_threshold: 35 },
        { metric: "roas", enabled: true, warning_threshold: 20, critical_threshold: 30 },
        { metric: "cpa", enabled: false, warning_threshold: 30, critical_threshold: 50 },
    ]);

    const [quietHours, setQuietHours] = useState({ enabled: false, start: "22:00", end: "08:00" });
    const [dailySummary, setDailySummary] = useState(true);
    const [showNewChannelForm, setShowNewChannelForm] = useState(false);
    const [newChannel, setNewChannel] = useState({ type: "EMAIL", name: "", value: "" });

    const updateAlertSetting = (metric: string, field: string, value: any) => {
        setAlertSettings((prev) =>
            prev.map((s) => (s.metric === metric ? { ...s, [field]: value } : s))
        );
    };

    const addChannel = () => {
        if (!newChannel.name || !newChannel.value) return;
        const channel: NotificationChannel = {
            id: Date.now().toString(),
            type: newChannel.type as any,
            name: newChannel.name,
            config: newChannel.type === "EMAIL" ? { email: newChannel.value } : { url: newChannel.value },
            enabled: true,
        };
        setChannels((prev) => [...prev, channel]);
        setNewChannel({ type: "EMAIL", name: "", value: "" });
        setShowNewChannelForm(false);
    };

    const removeChannel = (id: string) => {
        setChannels((prev) => prev.filter((c) => c.id !== id));
    };

    const toggleChannel = (id: string) => {
        setChannels((prev) =>
            prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
        );
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncMessage("");
        
        try {
            const token = localStorage.getItem("token");
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/sync/trigger?days=${syncDays}`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                    },
                }
            );
            
            const data = await response.json();
            
            if (response.ok) {
                setSyncMessage(`✅ Successfully synced ${syncDays} days of Google Ads data!`);
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                setSyncMessage(`❌ Sync failed: ${data.detail || "Unknown error"}`);
            }
        } catch (error) {
            setSyncMessage(`❌ Sync error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="space-y-8 animate-fade-in max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-display font-bold">Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure your notifications, alerts, and preferences
                </p>
            </div>

            {/* Google Ads Sync Section */}
            <section className="bg-gradient-to-br from-purple-900/20 to-cyan-900/20 rounded-2xl border border-purple-500/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-display font-semibold text-white">Google Ads Data Sync</h2>
                        <p className="text-sm text-gray-400">Manually sync your Google Ads data</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Number of days to sync
                        </label>
                        <select
                            value={syncDays}
                            onChange={(e) => setSyncDays(parseInt(e.target.value))}
                            className="w-full md:w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            disabled={syncing}
                        >
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                            <option value={60}>Last 60 days</option>
                            <option value={90}>Last 90 days</option>
                        </select>
                    </div>
                    
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl font-medium transition-all disabled:cursor-not-allowed"
                    >
                        <RefreshCw className={`w-5 h-5 ${syncing ? "animate-spin" : ""}`} />
                        {syncing ? "Syncing..." : "Sync Now"}
                    </button>
                    
                    {syncMessage && (
                        <div className={`p-4 rounded-xl border ${
                            syncMessage.startsWith("✅") 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        }`}>
                            {syncMessage}
                        </div>
                    )}
                    
                    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                        <p className="text-xs text-gray-400">
                            <strong className="text-gray-300">Note:</strong> Auto-sync runs every 6 hours automatically. 
                            Use manual sync if you need immediate data refresh. Large date ranges (60-90 days) may take several minutes.
                        </p>
                    </div>
                </div>
            </section>

            {/* Profile Section */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-semibold mb-4">Profile</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Name</label>
                        <input
                            type="text"
                            className="input"
                            defaultValue={user?.name || "User"}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                            type="email"
                            className="input"
                            defaultValue={user?.email || "user@example.com"}
                            disabled
                        />
                    </div>
                </div>
            </section>

            {/* Appearance */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-semibold mb-4">Appearance</h2>
                <div className="flex items-center gap-4">
                    <label className="text-sm">Theme</label>
                    <div className="flex items-center bg-muted rounded-lg p-1">
                        {["light", "dark", "system"].map((t) => (
                            <button
                                key={t}
                                onClick={() => setTheme(t as any)}
                                className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${theme === t ? "bg-card shadow-sm" : "hover:bg-muted/80"
                                    }`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Notification Channels */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold">Notification Channels</h2>
                    <button
                        onClick={() => setShowNewChannelForm(true)}
                        className="btn-primary text-sm"
                    >
                        Add Channel
                    </button>
                </div>

                <div className="space-y-3">
                    {channels.map((channel) => (
                        <div
                            key={channel.id}
                            className="flex items-center justify-between p-4 bg-muted rounded-xl"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${channel.type === "EMAIL" ? "bg-primary-500/20" : channel.type === "SLACK" ? "bg-success-500/20" : "bg-warning-500/20"
                                    }`}>
                                    {channel.type === "EMAIL" && "📧"}
                                    {channel.type === "SLACK" && "💬"}
                                    {channel.type === "WEBHOOK" && "🔗"}
                                </div>
                                <div>
                                    <p className="font-medium">{channel.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {channel.type === "EMAIL" ? channel.config.email : channel.config.url}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => toggleChannel(channel.id)}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${channel.enabled ? "bg-primary-500" : "bg-muted-foreground/30"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${channel.enabled ? "left-6" : "left-0.5"
                                            }`}
                                    />
                                </button>
                                <button
                                    onClick={() => removeChannel(channel.id)}
                                    className="btn-ghost p-2 text-danger-500"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {showNewChannelForm && (
                    <div className="mt-4 p-4 bg-muted rounded-xl space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm mb-1">Type</label>
                                <select
                                    value={newChannel.type}
                                    onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value })}
                                    className="input"
                                >
                                    <option value="EMAIL">Email</option>
                                    <option value="SLACK">Slack Webhook</option>
                                    <option value="WEBHOOK">Custom Webhook</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">Name</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g., Work Email"
                                    value={newChannel.name}
                                    onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">
                                    {newChannel.type === "EMAIL" ? "Email Address" : "Webhook URL"}
                                </label>
                                <input
                                    type={newChannel.type === "EMAIL" ? "email" : "url"}
                                    className="input"
                                    placeholder={newChannel.type === "EMAIL" ? "email@example.com" : "https://..."}
                                    value={newChannel.value}
                                    onChange={(e) => setNewChannel({ ...newChannel, value: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={addChannel} className="btn-primary text-sm">Add</button>
                            <button onClick={() => setShowNewChannelForm(false)} className="btn-ghost text-sm">Cancel</button>
                        </div>
                    </div>
                )}
            </section>

            {/* Alert Thresholds */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-lg font-display font-semibold mb-4">Alert Thresholds</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Configure when to receive alerts for each metric. Thresholds are percentage changes from the baseline.
                </p>
                <div className="space-y-4">
                    {alertSettings.map((setting) => (
                        <div
                            key={setting.metric}
                            className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-muted rounded-xl"
                        >
                            <div className="flex items-center gap-3 md:w-40">
                                <button
                                    onClick={() => updateAlertSetting(setting.metric, "enabled", !setting.enabled)}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${setting.enabled ? "bg-primary-500" : "bg-muted-foreground/30"
                                        }`}
                                >
                                    <span
                                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${setting.enabled ? "left-5" : "left-0.5"
                                            }`}
                                    />
                                </button>
                                <span className="font-medium capitalize">{setting.metric}</span>
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-warning-500 mb-1 block">Warning (%)</label>
                                    <input
                                        type="number"
                                        className="input text-sm"
                                        value={setting.warning_threshold}
                                        onChange={(e) => updateAlertSetting(setting.metric, "warning_threshold", parseInt(e.target.value))}
                                        disabled={!setting.enabled}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-danger-500 mb-1 block">Critical (%)</label>
                                    <input
                                        type="number"
                                        className="input text-sm"
                                        value={setting.critical_threshold}
                                        onChange={(e) => updateAlertSetting(setting.metric, "critical_threshold", parseInt(e.target.value))}
                                        disabled={!setting.enabled}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Quiet Hours */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-display font-semibold">Quiet Hours</h2>
                        <p className="text-sm text-muted-foreground">Pause notifications during specific times</p>
                    </div>
                    <button
                        onClick={() => setQuietHours({ ...quietHours, enabled: !quietHours.enabled })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${quietHours.enabled ? "bg-primary-500" : "bg-muted-foreground/30"
                            }`}
                    >
                        <span
                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${quietHours.enabled ? "left-6" : "left-0.5"
                                }`}
                        />
                    </button>
                </div>
                {quietHours.enabled && (
                    <div className="flex gap-4">
                        <div>
                            <label className="text-sm mb-1 block">Start</label>
                            <input
                                type="time"
                                className="input"
                                value={quietHours.start}
                                onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm mb-1 block">End</label>
                            <input
                                type="time"
                                className="input"
                                value={quietHours.end}
                                onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })}
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* Daily Summary */}
            <section className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-display font-semibold">Daily Summary</h2>
                        <p className="text-sm text-muted-foreground">Receive a daily email with your KPI summary</p>
                    </div>
                    <button
                        onClick={() => setDailySummary(!dailySummary)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${dailySummary ? "bg-primary-500" : "bg-muted-foreground/30"
                            }`}
                    >
                        <span
                            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${dailySummary ? "left-6" : "left-0.5"
                                }`}
                        />
                    </button>
                </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end">
                <button className="btn-primary px-8">
                    Save Changes
                </button>
            </div>
        </div>
    );
}
