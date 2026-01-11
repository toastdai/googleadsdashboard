/**
 * Simple in-memory cache for API responses
 * Prevents redundant fetches when navigating between pages with same date range
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    key: string;
}

class DataCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private maxAge: number = 5 * 60 * 1000; // 5 minutes default

    /**
     * Generate a cache key from date range and type
     */
    makeKey(type: string, startDate: string, endDate: string): string {
        return `${type}:${startDate}:${endDate}`;
    }

    /**
     * Get cached data if it exists and isn't expired
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        const age = Date.now() - entry.timestamp;
        if (age > this.maxAge) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data as T;
    }

    /**
     * Set data in cache
     */
    set<T>(key: string, data: T): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            key,
        });
    }

    /**
     * Check if key exists and is fresh
     */
    has(key: string): boolean {
        return this.get(key) !== null;
    }

    /**
     * Clear specific key
     */
    clear(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clearAll(): void {
        this.cache.clear();
    }

    /**
     * Get or fetch - returns cached data if available, otherwise calls fetcher
     */
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        options?: { forceRefresh?: boolean }
    ): Promise<T> {
        if (!options?.forceRefresh) {
            const cached = this.get<T>(key);
            if (cached !== null) {
                console.log(`[Cache HIT] ${key}`);
                return cached;
            }
        }
        
        console.log(`[Cache MISS] ${key} - fetching...`);
        const data = await fetcher();
        this.set(key, data);
        return data;
    }
}

// Singleton instance
export const dataCache = new DataCache();

// Cache keys for different data types
export const CacheKeys = {
    dashboard: (start: string, end: string) => dataCache.makeKey('dashboard', start, end),
    kelkoo: (start: string, end: string) => dataCache.makeKey('kelkoo', start, end),
    admedia: (start: string, end: string) => dataCache.makeKey('admedia', start, end),
    maxbounty: (start: string, end: string) => dataCache.makeKey('maxbounty', start, end),
    liveData: (start: string, end: string) => dataCache.makeKey('live', start, end),
};
