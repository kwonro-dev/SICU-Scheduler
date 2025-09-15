// Performance Monitor
// Tracks and displays performance improvements from hybrid approach

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            loadTimes: [],
            cacheHits: 0,
            cacheMisses: 0,
            networkRequests: 0,
            offlineLoads: 0
        };
        this.startTime = performance.now();
    }

    /**
     * Record a load time measurement
     */
    recordLoadTime(loadType, duration, dataSize = 0) {
        const metric = {
            type: loadType,
            duration: duration,
            dataSize: dataSize,
            timestamp: Date.now(),
            isOnline: navigator.onLine
        };
        
        this.metrics.loadTimes.push(metric);
        
        console.log(`📊 Performance: ${loadType} took ${duration.toFixed(2)}ms`);
        
        // Keep only last 50 measurements
        if (this.metrics.loadTimes.length > 50) {
            this.metrics.loadTimes.shift();
        }
    }

    /**
     * Record cache hit
     */
    recordCacheHit() {
        this.metrics.cacheHits++;
        console.log('💾 Cache hit');
    }

    /**
     * Record cache miss
     */
    recordCacheMiss() {
        this.metrics.cacheMisses++;
        console.log('❌ Cache miss');
    }

    /**
     * Record network request
     */
    recordNetworkRequest() {
        this.metrics.networkRequests++;
    }

    /**
     * Record offline load
     */
    recordOfflineLoad() {
        this.metrics.offlineLoads++;
        console.log('📴 Offline load');
    }

    /**
     * Get performance summary
     */
    getSummary() {
        const totalLoads = this.metrics.loadTimes.length;
        const avgLoadTime = totalLoads > 0 
            ? this.metrics.loadTimes.reduce((sum, metric) => sum + metric.duration, 0) / totalLoads
            : 0;
        
        const cacheHitRate = this.metrics.cacheHits + this.metrics.cacheMisses > 0
            ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
            : 0;

        const totalTime = performance.now() - this.startTime;

        return {
            totalLoads,
            avgLoadTime: avgLoadTime.toFixed(2),
            cacheHitRate: cacheHitRate.toFixed(1),
            networkRequests: this.metrics.networkRequests,
            offlineLoads: this.metrics.offlineLoads,
            totalTime: totalTime.toFixed(2),
            recentLoads: this.metrics.loadTimes.slice(-5)
        };
    }

    /**
     * Display performance dashboard
     */
    displayDashboard() {
        const summary = this.getSummary();
        
        console.log('📊 Performance Dashboard:');
        console.log('========================');
        console.log(`Total loads: ${summary.totalLoads}`);
        console.log(`Average load time: ${summary.avgLoadTime}ms`);
        console.log(`Cache hit rate: ${summary.cacheHitRate}%`);
        console.log(`Network requests: ${summary.networkRequests}`);
        console.log(`Offline loads: ${summary.offlineLoads}`);
        console.log(`Total session time: ${summary.totalTime}ms`);
        console.log('Recent loads:', summary.recentLoads);
    }

    /**
     * Compare with baseline (localStorage)
     */
    compareWithBaseline() {
        const summary = this.getSummary();
        const baselineTime = 5; // Expected localStorage time
        
        const improvement = summary.avgLoadTime > 0 
            ? ((baselineTime - summary.avgLoadTime) / baselineTime) * 100
            : 0;
        
        console.log('📈 Performance Comparison:');
        console.log('==========================');
        console.log(`Baseline (localStorage): ~${baselineTime}ms`);
        console.log(`Current average: ${summary.avgLoadTime}ms`);
        console.log(`Improvement: ${improvement.toFixed(1)}%`);
        
        if (summary.cacheHitRate > 50) {
            console.log('🎉 Cache is working well!');
        } else {
            console.log('⚠️ Cache hit rate could be improved');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceMonitor;
} else {
    window.PerformanceMonitor = PerformanceMonitor;
}
