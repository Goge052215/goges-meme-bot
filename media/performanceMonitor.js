class PerformanceMonitor {
    constructor() {
        this.metrics = {
            searchRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            activeStreams: 0,
            totalStreams: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    recordSearchRequest() { this.metrics.searchRequests++; }
    recordCacheHit() { this.metrics.cacheHits++; }
    recordCacheMiss() { this.metrics.cacheMisses++; }
    recordSearchTime() {} // No-op
    recordStreamStart() { 
        this.metrics.totalStreams++; 
        this.metrics.activeStreams++; 
    }
    recordStreamEnd() { 
        this.metrics.activeStreams = Math.max(0, this.metrics.activeStreams - 1); 
    }
    recordError() { this.metrics.errors++; }

    getCacheHitRate() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        return total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(2) : 0;
    }

    getUptime() {
        return Date.now() - this.metrics.startTime;
    }

    getUptimeFormatted() {
        const uptime = this.getUptime();
        const hours = Math.floor(uptime / (1000 * 60 * 60));
        const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    getStats() {
        return {
            ...this.metrics,
            cacheHitRate: this.getCacheHitRate(),
            uptime: this.getUptimeFormatted()
        };
    }

    reset() {
        this.metrics = {
            searchRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            activeStreams: 0,
            totalStreams: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    logStats() {
        if (process.env.DEBUG_PERFORMANCE) {
            const stats = this.getStats();
            console.log(`[DEBUG] Stats: ${stats.searchRequests} searches, ${stats.cacheHitRate}% cache hit, ${stats.uptime} uptime`);
        }
    }
}

const performanceMonitor = new PerformanceMonitor();

module.exports = { performanceMonitor, PerformanceMonitor }; 