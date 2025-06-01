class PerformanceMonitor {
    constructor() {
        this.metrics = {
            searchRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            activeStreams: 0,
            totalStreams: 0,
            averageSearchTime: 0,
            averageStreamStartTime: 0,
            errors: 0,
            startTime: Date.now()
        };
        
        this.searchTimes = [];
        this.streamTimes = [];
        this.maxHistorySize = 100;
    }

    recordSearchRequest() {
        this.metrics.searchRequests++;
    }

    recordCacheHit() {
        this.metrics.cacheHits++;
    }

    recordCacheMiss() {
        this.metrics.cacheMisses++;
    }

    recordSearchTime(timeMs) {
        this.searchTimes.push(timeMs);
        if (this.searchTimes.length > this.maxHistorySize) {
            this.searchTimes.shift();
        }
        this.metrics.averageSearchTime = this.searchTimes.reduce((a, b) => a + b, 0) / this.searchTimes.length;
    }

    recordStreamStart(timeMs) {
        this.metrics.totalStreams++;
        this.metrics.activeStreams++;
        
        this.streamTimes.push(timeMs);
        if (this.streamTimes.length > this.maxHistorySize) {
            this.streamTimes.shift();
        }
        this.metrics.averageStreamStartTime = this.streamTimes.reduce((a, b) => a + b, 0) / this.streamTimes.length;
    }

    recordStreamEnd() {
        this.metrics.activeStreams = Math.max(0, this.metrics.activeStreams - 1);
    }

    recordError() {
        this.metrics.errors++;
    }

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
        const seconds = Math.floor((uptime % (1000 * 60)) / 1000);
        return `${hours}h ${minutes}m ${seconds}s`;
    }

    getStats() {
        return {
            ...this.metrics,
            cacheHitRate: this.getCacheHitRate(),
            uptime: this.getUptimeFormatted(),
            uptimeMs: this.getUptime()
        };
    }

    reset() {
        this.metrics = {
            searchRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            activeStreams: 0,
            totalStreams: 0,
            averageSearchTime: 0,
            averageStreamStartTime: 0,
            errors: 0,
            startTime: Date.now()
        };
        this.searchTimes = [];
        this.streamTimes = [];
    }

    logStats() {
        const stats = this.getStats();
        console.log('📊 Performance Stats:');
        console.log(`   Search Requests: ${stats.searchRequests}`);
        console.log(`   Cache Hit Rate: ${stats.cacheHitRate}%`);
        console.log(`   Active Streams: ${stats.activeStreams}`);
        console.log(`   Total Streams: ${stats.totalStreams}`);
        console.log(`   Avg Search Time: ${stats.averageSearchTime.toFixed(0)}ms`);
        console.log(`   Avg Stream Start: ${stats.averageStreamStartTime.toFixed(0)}ms`);
        console.log(`   Errors: ${stats.errors}`);
        console.log(`   Uptime: ${stats.uptime}`);
    }
}

const performanceMonitor = new PerformanceMonitor();

// Log stats every 10 minutes
setInterval(() => {
    performanceMonitor.logStats();
}, 10 * 60 * 1000);

module.exports = { performanceMonitor, PerformanceMonitor }; 