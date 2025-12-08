"use client";

import { useState, useRef } from "react";

interface DataTableColumn<T> {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    format?: "number" | "currency" | "percent" | "date";
    render?: (value: any, row: T) => React.ReactNode;
    align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    title?: string;
    searchable?: boolean;
    searchKeys?: string[];
    paginate?: boolean;
    pageSize?: number;
    onExport?: (format: "csv" | "json") => void;
}

export function DataTable<T extends Record<string, any>>({
    data,
    columns,
    title,
    searchable = true,
    searchKeys = [],
    paginate = true,
    pageSize = 10,
    onExport,
}: DataTableProps<T>) {
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(0);
    const tableRef = useRef<HTMLTableElement>(null);

    // Filter data by search
    const filteredData = data.filter((row) => {
        if (!search) return true;
        const keys = searchKeys.length > 0 ? searchKeys : columns.map((c) => String(c.key));
        return keys.some((key) => {
            const value = row[key];
            if (value == null) return false;
            return String(value).toLowerCase().includes(search.toLowerCase());
        });
    });

    // Sort data
    const sortedData = [...filteredData].sort((a, b) => {
        if (!sortKey) return 0;
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
            return sortDir === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortDir === "asc"
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
    });

    // Paginate data
    const totalPages = Math.ceil(sortedData.length / pageSize);
    const paginatedData = paginate
        ? sortedData.slice(page * pageSize, (page + 1) * pageSize)
        : sortedData;

    const handleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const formatValue = (value: any, format?: string): string => {
        if (value == null) return "-";
        switch (format) {
            case "currency":
                if (typeof value === "number") {
                    if (value >= 100000) return `Rs.${(value / 100000).toFixed(2)}L`;
                    if (value >= 1000) return `Rs.${(value / 1000).toFixed(2)}K`;
                    return `Rs.${value.toFixed(2)}`;
                }
                return String(value);
            case "percent":
                return typeof value === "number" ? `${value.toFixed(2)}%` : String(value);
            case "number":
                return typeof value === "number" ? value.toLocaleString() : String(value);
            case "date":
                return new Date(value).toLocaleDateString("en-IN");
            default:
                return String(value);
        }
    };

    const exportCSV = () => {
        const headers = columns.map((c) => c.header).join(",");
        const rows = sortedData.map((row) =>
            columns
                .map((col) => {
                    const value = row[col.key as keyof T];
                    return typeof value === "string" && value.includes(",")
                        ? `"${value}"`
                        : value;
                })
                .join(",")
        );
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "data"}-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportJSON = () => {
        const json = JSON.stringify(sortedData, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${title || "data"}-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    {title && <h3 className="text-lg font-display font-semibold">{title}</h3>}
                    <p className="text-sm text-muted-foreground">
                        {sortedData.length} {sortedData.length === 1 ? "item" : "items"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {searchable && (
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(0);
                            }}
                            className="input w-48"
                            data-search-input
                        />
                    )}
                    <div className="flex items-center gap-1">
                        <button onClick={exportCSV} className="btn-ghost text-sm px-2.5 py-1.5 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="hidden sm:inline">CSV</span>
                        </button>
                        <button onClick={exportJSON} className="btn-ghost text-sm px-2.5 py-1.5 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="hidden sm:inline">JSON</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <table ref={tableRef} className="data-table text-sm">
                    <thead>
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.sortable !== false ? "cursor-pointer hover:bg-muted/80 select-none" : ""
                                        }`}
                                    onClick={() => col.sortable !== false && handleSort(String(col.key))}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>{col.header}</span>
                                        {col.sortable !== false && sortKey === String(col.key) && (
                                            <svg
                                                className={`w-4 h-4 transition-transform ${sortDir === "asc" ? "rotate-180" : ""}`}
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        )}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                                    No data found
                                </td>
                            </tr>
                        ) : (
                            paginatedData.map((row, rowIndex) => (
                                <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
                                    {columns.map((col) => (
                                        <td
                                            key={String(col.key)}
                                            className={`${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} tabular-nums`}
                                        >
                                            {col.render
                                                ? col.render(row[col.key as keyof T], row)
                                                : formatValue(row[col.key as keyof T], col.format)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {paginate && totalPages > 1 && (
                <div className="p-4 border-t border-border flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                        Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, sortedData.length)} of {sortedData.length}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(Math.max(0, page - 1))}
                            disabled={page === 0}
                            className="btn-ghost px-3 py-1.5 disabled:opacity-50"
                        >
                            Previous
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const p = page < 3 ? i : page > totalPages - 3 ? totalPages - 5 + i : page - 2 + i;
                            if (p < 0 || p >= totalPages) return null;
                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 rounded-lg text-sm ${p === page ? "bg-primary-500 text-white" : "hover:bg-muted"
                                        }`}
                                >
                                    {p + 1}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                            disabled={page >= totalPages - 1}
                            className="btn-ghost px-3 py-1.5 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
