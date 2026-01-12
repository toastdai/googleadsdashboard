"use client";

import { createContext, useContext, ReactNode } from "react";

// Enforce Dark Mode Only
type Theme = "dark";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: any) => void; // Accept any but do nothing
    resolvedTheme: "dark";
}

// Default context value
const ThemeContext = createContext<ThemeContextType>({
    theme: "dark",
    setTheme: () => { }, // No-op
    resolvedTheme: "dark",
});

export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    // This component now purely enforces dark mode.
    // It does NOT touch window.document.documentElement (html tag)
    // because that is already handled in layout.tsx with className="dark".
    // We strictly return "dark" for any consumers of useTheme().

    return (
        <ThemeContext.Provider value={{ theme: "dark", setTheme: () => { }, resolvedTheme: "dark" }}>
            {children}
        </ThemeContext.Provider>
    );
}
