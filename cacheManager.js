// Cache Manager Module
// Implements intelligent caching to reduce Firestore reads

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.maxCacheSize = 50; // Maximum number of cached items
    }

    /**
     * Get data from cache if available and not expired
     */
    get(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (!timestamp || Date.now() - timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
            return null;
        }
        return this.cache.get(key);
    }

    /**
     * Store data in cache with timestamp
     */
    set(key, data) {
        // Remove oldest items if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
            this.cacheTimestamps.delete(oldestKey);
        }

        this.cache.set(key, data);
        this.cacheTimestamps.set(key, Date.now());
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            hitRate: this.calculateHitRate()
        };
    }

    calculateHitRate() {
        // Simple hit rate calculation - would need more sophisticated tracking
        return 'N/A';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
} else {
    window.CacheManager = CacheManager;
}
