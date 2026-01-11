"use client";

import { Sidebar } from "@/components/sidebar";
import { DateRangeProvider } from "@/lib/date-context";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DateRangeProvider>
            <div className="min-h-screen bg-background">
                <Sidebar />
                <main className="ml-64 min-h-screen">
                    <div className="p-6 md:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </DateRangeProvider>
    );
}
