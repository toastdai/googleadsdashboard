"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useEffect } from 'react';

// Date range type
export interface DateRange {
    start: string;
    end: string;
}

// Preset options
export type DatePreset = '7d' | '14d' | '30d' | '90d' | 'custom';

interface DateRangeContextValue {
    dateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    preset: DatePreset;
    setPreset: (preset: DatePreset) => void;
    dateRangeLabel: string;
    applyPreset: (presetId: DatePreset) => void;
}

const DateRangeContext = createContext<DateRangeContextValue | undefined>(undefined);

// LocalStorage key
const STORAGE_KEY = 'dashboard_date_range';

// Helper to format date range as human-readable label
function formatDateRangeLabel(startDate: string, endDate: string): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Check for common presets
    const endIsToday = end.toDateString() === today.toDateString();
    if (endIsToday) {
        if (diffDays === 7) return "Last 7 days";
        if (diffDays === 14) return "Last 14 days";
        if (diffDays === 30) return "Last 30 days";
        if (diffDays === 90) return "Last 90 days";
    }
    
    // Format custom range
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${formatDate(start)} - ${formatDate(end)}`;
}

// Get default date range (last 30 days)
function getDefaultDateRange(): DateRange {
    const today = new Date();
    const endDate = today.toISOString().split("T")[0];
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - 29); // 30 days including today
    const startDate = startDay.toISOString().split("T")[0];
    return { start: startDate, end: endDate };
}

// Load date range from localStorage
function loadDateRange(): { dateRange: DateRange; preset: DatePreset } | null {
    if (typeof window === 'undefined') return null;
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        
        const parsed = JSON.parse(stored);
        // Validate the structure
        if (parsed.dateRange?.start && parsed.dateRange?.end && parsed.preset) {
            return parsed;
        }
    } catch (e) {
        console.warn('Failed to load date range from localStorage:', e);
    }
    return null;
}

// Save date range to localStorage
function saveDateRange(dateRange: DateRange, preset: DatePreset) {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateRange, preset }));
    } catch (e) {
        console.warn('Failed to save date range to localStorage:', e);
    }
}

interface DateRangeProviderProps {
    children: ReactNode;
    initialDateRange?: DateRange;
}

export function DateRangeProvider({ children, initialDateRange }: DateRangeProviderProps) {
    // Initialize from localStorage or default
    const [dateRange, setDateRangeState] = useState<DateRange>(() => {
        const loaded = loadDateRange();
        return loaded?.dateRange || initialDateRange || getDefaultDateRange();
    });
    
    const [preset, setPresetState] = useState<DatePreset>(() => {
        const loaded = loadDateRange();
        return loaded?.preset || '30d';
    });

    const setDateRange = useCallback((range: DateRange) => {
        setDateRangeState(range);
        // Detect if this matches a preset
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const end = new Date(range.end);
        end.setHours(0, 0, 0, 0);
        const start = new Date(range.start);
        start.setHours(0, 0, 0, 0);
        
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const endIsToday = end.toDateString() === today.toDateString();
        
        let detectedPreset: DatePreset = 'custom';
        if (endIsToday) {
            if (diffDays === 7) detectedPreset = '7d';
            else if (diffDays === 14) detectedPreset = '14d';
            else if (diffDays === 30) detectedPreset = '30d';
            else if (diffDays === 90) detectedPreset = '90d';
        }
        
        setPresetState(detectedPreset);
        saveDateRange(range, detectedPreset);
    }, []);

    const setPreset = useCallback((newPreset: DatePreset) => {
        setPresetState(newPreset);
        saveDateRange(dateRange, newPreset);
    }, [dateRange]);

    const applyPreset = useCallback((presetId: DatePreset) => {
        setPresetState(presetId);
        if (presetId === 'custom') return;
        
        const today = new Date();
        const endDate = today.toISOString().split("T")[0];
        const startDay = new Date(today);
        
        switch (presetId) {
            case '7d':
                startDay.setDate(today.getDate() - 6);
                break;
            case '14d':
                startDay.setDate(today.getDate() - 13);
                break;
            case '30d':
                startDay.setDate(today.getDate() - 29);
                break;
            case '90d':
                startDay.setDate(today.getDate() - 89);
                break;
        }
        
        const startDate = startDay.toISOString().split("T")[0];
        const newRange = { start: startDate, end: endDate };
        setDateRangeState(newRange);
        saveDateRange(newRange, presetId);
    }, []);

    const dateRangeLabel = useMemo(
        () => formatDateRangeLabel(dateRange.start, dateRange.end),
        [dateRange]
    );

    const value = useMemo<DateRangeContextValue>(() => ({
        dateRange,
        setDateRange,
        preset,
        setPreset,
        dateRangeLabel,
        applyPreset,
    }), [dateRange, setDateRange, preset, dateRangeLabel, applyPreset]);

    return (
        <DateRangeContext.Provider value={value}>
            {children}
        </DateRangeContext.Provider>
    );
}

// Hook to use date range context
export function useDateRange(): DateRangeContextValue {
    const context = useContext(DateRangeContext);
    if (context === undefined) {
        throw new Error('useDateRange must be used within a DateRangeProvider');
    }
    return context;
}

// Export helper for components that need date range but might be outside provider
export function useDateRangeOptional(): DateRangeContextValue | null {
    return useContext(DateRangeContext) ?? null;
}
