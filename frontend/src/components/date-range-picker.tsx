"use client";

import { useState } from "react";

// Date range presets
type DatePreset = "today" | "yesterday" | "last7" | "last30" | "last90" | "custom";

interface DateRangePickerProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
    const [preset, setPreset] = useState<DatePreset>("last7");
    const [isOpen, setIsOpen] = useState(false);

    const getPresetDates = (preset: DatePreset): { start: string; end: string } => {
        const today = new Date();
        const formatDate = (d: Date) => d.toISOString().split("T")[0];

        switch (preset) {
            case "today":
                return { start: formatDate(today), end: formatDate(today) };
            case "yesterday": {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return { start: formatDate(yesterday), end: formatDate(yesterday) };
            }
            case "last7": {
                const end = new Date(today);
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                return { start: formatDate(start), end: formatDate(end) };
            }
            case "last30": {
                const end = new Date(today);
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 29);
                return { start: formatDate(start), end: formatDate(end) };
            }
            case "last90": {
                const end = new Date(today);
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 89);
                return { start: formatDate(start), end: formatDate(end) };
            }
            default:
                return { start: startDate, end: endDate };
        }
    };

    const handlePresetChange = (newPreset: DatePreset) => {
        setPreset(newPreset);
        if (newPreset !== "custom") {
            const dates = getPresetDates(newPreset);
            onChange(dates.start, dates.end);
        }
        setIsOpen(false);
    };

    const presets: { label: string; value: DatePreset }[] = [
        { label: "Today", value: "today" },
        { label: "Yesterday", value: "yesterday" },
        { label: "Last 7 days", value: "last7" },
        { label: "Last 30 days", value: "last30" },
        { label: "Last 90 days", value: "last90" },
        { label: "Custom range", value: "custom" },
    ];

    const formatDisplayDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
        });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-secondary flex items-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}</span>
                <svg className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 z-20 w-64 bg-card border border-border rounded-xl shadow-lg p-2 animate-fade-in">
                        {presets.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => handlePresetChange(p.value)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${preset === p.value
                                        ? "bg-primary-500/10 text-primary-500"
                                        : "hover:bg-muted"
                                    }`}
                            >
                                {p.label}
                            </button>
                        ))}

                        {preset === "custom" && (
                            <div className="mt-2 pt-2 border-t border-border space-y-2">
                                <div>
                                    <label className="text-xs text-muted-foreground">Start</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => onChange(e.target.value, endDate)}
                                        className="input text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground">End</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => onChange(startDate, e.target.value)}
                                        className="input text-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
