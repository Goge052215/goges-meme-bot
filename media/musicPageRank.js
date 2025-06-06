const fs = require('fs');
const path = require('path');

class MusicPageRank {
    constructor() {
        this.graphPath = path.join(__dirname, '../musicGraph.json');
        this.songGraph = new Map();
        this.artistGraph = new Map();
        this.pageRankScores = new Map();
        this.artistPageRankScores = new Map();
        
        this.dampingFactor = 0.85;
        this.convergenceThreshold = 0.001; 
        this.maxIterations = 30;
        
        const theoreticalMax = Math.ceil(Math.log(1 / this.convergenceThreshold) / (1 - this.dampingFactor));
        if (this.maxIterations < theoreticalMax) {
            console.log(`[MusicPageRank] Adjusting maxIterations from ${this.maxIterations} to theoretical bound ${theoreticalMax} for convergence`);
            this.maxIterations = theoreticalMax;
        } else {
            console.log(`[MusicPageRank] Using theoretical bound ${theoreticalMax} as maxIterations for optimal convergence`);
            this.maxIterations = theoreticalMax;
        }
        this.minGraphSizeForPageRank = 5; 
        
        this.dirtyNodes = new Set();
        this.lastFullCalculation = 0;
        this.fullCalculationInterval = 6 * 60 * 60 * 1000; // 6 hours
        this.pendingUpdates = [];
        this.batchUpdateInterval = 30000; // 30 seconds
        
        this.isCalculating = false;
        this.calculationQueue = [];
        this.scoreCache = new Map();
        this.scoreCacheTimeout = 5 * 60 * 1000; // 5 minutes
        
        this.weights = {
            playlistCooccurrence: 1.0,
            queueCooccurrence: 0.8,
            artistCollaboration: 0.6,
            genreSimilarity: 0.4,
            searchCooccurrence: 0.5,
            userInteraction: 0.7
        };
        
        this.loadGraph();
        this.schedulePeriodicUpdates();
        this.startBatchProcessor();
    }

    loadGraph() {
        try {
            if (fs.existsSync(this.graphPath)) {
                const data = JSON.parse(fs.readFileSync(this.graphPath, 'utf8'));
                
                // Reconstruct Maps and Sets from serialized data
                if (data.songGraph) {
                    for (const [nodeId, nodeData] of Object.entries(data.songGraph)) {
                        this.songGraph.set(nodeId, {
                            outlinks: new Set(nodeData.outlinks || []),
                            inlinks: new Set(nodeData.inlinks || []),
                            metadata: nodeData.metadata || {},
                            lastUpdated: nodeData.lastUpdated || 0
                        });
                    }
                }
                
                if (data.artistGraph) {
                    for (const [nodeId, nodeData] of Object.entries(data.artistGraph)) {
                        this.artistGraph.set(nodeId, {
                            outlinks: new Set(nodeData.outlinks || []),
                            inlinks: new Set(nodeData.inlinks || []),
                            metadata: nodeData.metadata || {},
                            lastUpdated: nodeData.lastUpdated || 0
                        });
                    }
                }
                
                if (data.pageRankScores) {
                    this.pageRankScores = new Map(Object.entries(data.pageRankScores));
                }
                
                if (data.artistPageRankScores) {
                    this.artistPageRankScores = new Map(Object.entries(data.artistPageRankScores));
                }
                
                this.lastFullCalculation = data.lastFullCalculation || 0;
                
                console.log(`[MusicPageRank] Loaded optimized graph with ${this.songGraph.size} songs and ${this.artistGraph.size} artists`);
            }
        } catch (error) {
            console.error('[MusicPageRank] Error loading graph:', error.message);
            this.initializeEmptyGraph();
        }
    }

    initializeEmptyGraph() {
        this.songGraph = new Map();
        this.artistGraph = new Map();
        this.pageRankScores = new Map();
        this.artistPageRankScores = new Map();
        this.dirtyNodes = new Set();
        this.lastFullCalculation = 0;
    }

    saveGraph() {
        try {
            const data = {
                songGraph: {},
                artistGraph: {},
                pageRankScores: Object.fromEntries(this.pageRankScores),
                artistPageRankScores: Object.fromEntries(this.artistPageRankScores),
                lastFullCalculation: this.lastFullCalculation,
                lastUpdated: Date.now()
            };
            
            // Serialize with performance metadata
            for (const [nodeId, nodeData] of this.songGraph.entries()) {
                data.songGraph[nodeId] = {
                    outlinks: Array.from(nodeData.outlinks),
                    inlinks: Array.from(nodeData.inlinks),
                    metadata: nodeData.metadata,
                    lastUpdated: nodeData.lastUpdated
                };
            }
            
            for (const [nodeId, nodeData] of this.artistGraph.entries()) {
                data.artistGraph[nodeId] = {
                    outlinks: Array.from(nodeData.outlinks),
                    inlinks: Array.from(nodeData.inlinks),
                    metadata: nodeData.metadata,
                    lastUpdated: nodeData.lastUpdated
                };
            }
            
            fs.writeFileSync(this.graphPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[MusicPageRank] Error saving graph:', error.message);
        }
    }

    addSong(songId, metadata = {}) {
        const now = Date.now();
        if (!this.songGraph.has(songId)) {
            this.songGraph.set(songId, {
                outlinks: new Set(),
                inlinks: new Set(),
                metadata: {
                    title: metadata.title || '',
                    artist: metadata.artist || '',
                    source: metadata.source || '',
                    addedAt: now,
                    playCount: 0,
                    searchCount: 0,
                    ...metadata
                },
                lastUpdated: now
            });
            this.markNodeDirty(songId);
        } else {
            const existing = this.songGraph.get(songId);
            existing.metadata = { ...existing.metadata, ...metadata };
            existing.lastUpdated = now;
            this.markNodeDirty(songId);
        }
    }

    addArtist(artistId, metadata = {}) {
        const now = Date.now();
        if (!this.artistGraph.has(artistId)) {
            this.artistGraph.set(artistId, {
                outlinks: new Set(),
                inlinks: new Set(),
                metadata: {
                    name: metadata.name || artistId,
                    genre: metadata.genre || '',
                    addedAt: now,
                    playCount: 0,
                    ...metadata
                },
                lastUpdated: now
            });
        }
    }

    markNodeDirty(nodeId) {
        this.dirtyNodes.add(nodeId);
        // Mark connected nodes as dirty too for incremental updates
        const node = this.songGraph.get(nodeId);
        if (node) {
            for (const connectedId of [...node.inlinks, ...node.outlinks]) {
                this.dirtyNodes.add(connectedId);
            }
        }
        
        // Clear cache for affected nodes
        this.scoreCache.delete(nodeId);
    }

    addSongRelationship(fromSongId, toSongId, relationshipType, weight = 1.0) {
        this.addSong(fromSongId);
        this.addSong(toSongId);
        
        const typeWeight = this.weights[relationshipType] || 1.0;
        const finalWeight = typeWeight * weight;
        
        if (finalWeight > 0.1) {
            const fromNode = this.songGraph.get(fromSongId);
            const toNode = this.songGraph.get(toSongId);
            
            const wasConnected = fromNode.outlinks.has(toSongId);
            
            fromNode.outlinks.add(toSongId);
            toNode.inlinks.add(fromSongId);
            
            if (!wasConnected) {
                this.markNodeDirty(fromSongId);
                this.markNodeDirty(toSongId);
            }
        }
    }

    // Batch processing for better performance
    startBatchProcessor() {
        setInterval(() => {
            if (this.pendingUpdates.length > 0) {
                this.processBatchUpdates();
            }
        }, this.batchUpdateInterval);
    }

    processBatchUpdates() {
        const updates = this.pendingUpdates.splice(0);
        console.log(`[MusicPageRank] Processing ${updates.length} batch updates`);
        
        // Group updates by type for efficiency
        const playlistUpdates = updates.filter(u => u.type === 'playlist');
        const queueUpdates = updates.filter(u => u.type === 'queue');
        const searchUpdates = updates.filter(u => u.type === 'search');
        
        // Process in batches
        playlistUpdates.forEach(update => this.recordPlaylistCooccurrence(update.songIds, update.metadata));
        queueUpdates.forEach(update => this.recordQueueCooccurrence(update.songIds));
        searchUpdates.forEach(update => this.recordSearchQuery(update.query, update.songIds));
        
        // Trigger incremental calculation if enough changes
        if (this.dirtyNodes.size > 10) {
            this.scheduleIncrementalCalculation();
        }
    }

    recordPlaylistCooccurrence(songIds, playlistMetadata = {}) {
        if (songIds.length < 2) return;
        
        // Use sparse matrix approach for large playlists
        if (songIds.length > 50) {
            this.recordSparsePlaylistCooccurrence(songIds, playlistMetadata);
            return;
        }
        
        for (let i = 0; i < songIds.length; i++) {
            for (let j = i + 1; j < songIds.length; j++) {
                const distance = Math.abs(i - j);
                const weight = Math.max(0.1, 1.0 - (distance * 0.05)); // More generous weight decay
                
                this.addSongRelationship(songIds[i], songIds[j], 'playlistCooccurrence', weight);
                this.addSongRelationship(songIds[j], songIds[i], 'playlistCooccurrence', weight);
            }
            
            if (this.songGraph.has(songIds[i])) {
                this.songGraph.get(songIds[i]).metadata.playCount++;
            }
        }
    }

    recordSparsePlaylistCooccurrence(songIds, playlistMetadata = {}) {
        // For large playlists, only connect adjacent and nearby songs
        const maxConnections = 5;
        
        for (let i = 0; i < songIds.length; i++) {
            const connectionsToMake = Math.min(maxConnections, songIds.length - i - 1);
            
            for (let j = 1; j <= connectionsToMake; j++) {
                if (i + j < songIds.length) {
                    const weight = Math.max(0.1, 1.0 - (j * 0.15));
                    this.addSongRelationship(songIds[i], songIds[i + j], 'playlistCooccurrence', weight);
                    this.addSongRelationship(songIds[i + j], songIds[i], 'playlistCooccurrence', weight);
                }
            }
            
            if (this.songGraph.has(songIds[i])) {
                this.songGraph.get(songIds[i]).metadata.playCount++;
            }
        }
    }

    recordQueueCooccurrence(songIds) {
        if (songIds.length < 2) return;
        
        // Use sliding window for queue relationships
        const windowSize = Math.min(5, songIds.length);
        
        for (let i = 0; i < songIds.length - 1; i++) {
            const endIndex = Math.min(i + windowSize, songIds.length);
            
            for (let j = i + 1; j < endIndex; j++) {
                const distance = j - i;
                const weight = Math.max(0.2, 1.0 - (distance * 0.1));
                this.addSongRelationship(songIds[i], songIds[j], 'queueCooccurrence', weight);
            }
        }
    }

    recordSearchQuery(query, resultSongIds) {
        if (resultSongIds.length < 2) return;
        
        // Only connect top results to avoid noise
        const maxResults = Math.min(5, resultSongIds.length);
        
        for (let i = 0; i < maxResults; i++) {
            for (let j = i + 1; j < maxResults; j++) {
                const positionPenalty = (i + j) * 0.05;
                const weight = Math.max(0.1, 0.8 - positionPenalty);
                this.addSongRelationship(resultSongIds[i], resultSongIds[j], 'searchCooccurrence', weight);
            }
            
            if (this.songGraph.has(resultSongIds[i])) {
                this.songGraph.get(resultSongIds[i]).metadata.searchCount++;
            }
        }
    }

    // Asynchronous PageRank calculation
    async calculatePageRank(forceFullCalculation = false) {
        if (this.isCalculating) {
            return new Promise((resolve) => {
                this.calculationQueue.push(resolve);
            });
        }

        const startTime = Date.now();
        this.isCalculating = true;

        try {
            if (this.songGraph.size < this.minGraphSizeForPageRank) {
                console.log('[MusicPageRank] Graph too small for PageRank calculation');
                return;
            }

            const shouldDoFullCalculation = forceFullCalculation || 
                (Date.now() - this.lastFullCalculation > this.fullCalculationInterval) ||
                this.dirtyNodes.size > this.songGraph.size * 0.1;

            if (shouldDoFullCalculation) {
                await this.calculateFullPageRank();
                this.lastFullCalculation = Date.now();
                this.dirtyNodes.clear();
            } else if (this.dirtyNodes.size > 0) {
                await this.calculateIncrementalPageRank();
            }

            const endTime = Date.now();
            console.log(`[MusicPageRank] PageRank calculation completed in ${endTime - startTime}ms`);

            this.saveGraph();
        } finally {
            this.isCalculating = false;
            
            // Process queued calculations
            const queue = this.calculationQueue.splice(0);
            queue.forEach(resolve => resolve());
        }
    }

    async calculateFullPageRank() {
        console.log(`[MusicPageRank] Full PageRank calculation for ${this.songGraph.size} songs...`);
        
        const newScores = new Map();
        const nodes = Array.from(this.songGraph.keys());
        const initialScore = 1.0 / nodes.length;
        
        // Initialize scores
        for (const nodeId of nodes) {
            newScores.set(nodeId, initialScore);
        }
        
        // Adaptive convergence threshold based on graph size
        const adaptiveThreshold = Math.max(0.0001, this.convergenceThreshold / Math.sqrt(nodes.length));
        
        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            const updatedScores = await this.performPageRankIteration(nodes, newScores);
            
            const maxChange = this.calculateMaxChange(newScores, updatedScores);
            
            // Update scores
            for (const [nodeId, score] of updatedScores) {
                newScores.set(nodeId, score);
            }
            
            if (maxChange < adaptiveThreshold) {
                console.log(`[MusicPageRank] Full calculation converged after ${iteration + 1} iterations (threshold: ${adaptiveThreshold.toFixed(6)})`);
                break;
            }
            
            // Yield control periodically to prevent blocking
            if (iteration % 5 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        
        this.pageRankScores = newScores;
        this.clearScoreCache();
    }

    async calculateIncrementalPageRank() {
        if (this.dirtyNodes.size === 0) return;
        
        console.log(`[MusicPageRank] Incremental PageRank update for ${this.dirtyNodes.size} dirty nodes`);
        
        const affectedNodes = new Set(this.dirtyNodes);
        
        // Expand to include neighbors of dirty nodes
        for (const nodeId of this.dirtyNodes) {
            const node = this.songGraph.get(nodeId);
            if (node) {
                for (const neighborId of [...node.inlinks, ...node.outlinks]) {
                    affectedNodes.add(neighborId);
                }
            }
        }
        
        const nodes = Array.from(affectedNodes);
        const currentScores = new Map();
        
        // Initialize with current scores or default
        for (const nodeId of nodes) {
            currentScores.set(nodeId, this.pageRankScores.get(nodeId) || (1.0 / this.songGraph.size));
        }
        
        // Perform limited iterations on affected nodes only
        const maxIncrementalIterations = Math.min(10, this.maxIterations);
        
        for (let iteration = 0; iteration < maxIncrementalIterations; iteration++) {
            const updatedScores = await this.performPageRankIteration(nodes, currentScores, true);
            
            const maxChange = this.calculateMaxChange(currentScores, updatedScores);
            
            // Update scores
            for (const [nodeId, score] of updatedScores) {
                currentScores.set(nodeId, score);
                this.pageRankScores.set(nodeId, score);
            }
            
            if (maxChange < this.convergenceThreshold * 2) { // Relaxed threshold for incremental updates
                console.log(`[MusicPageRank] Incremental calculation converged after ${iteration + 1} iterations`);
                break;
            }
        }
        
        this.dirtyNodes.clear();
        this.clearScoreCache();
    }

    async performPageRankIteration(nodes, currentScores, isIncremental = false) {
        const updatedScores = new Map();
        const totalNodes = isIncremental ? this.songGraph.size : nodes.length;
        
        for (const nodeId of nodes) {
            const node = this.songGraph.get(nodeId);
            if (!node) continue;
            
            let score = (1 - this.dampingFactor) / totalNodes;
            
            // Calculate contribution from inlinks
            for (const inlinkId of node.inlinks) {
                const inlinkScore = currentScores.get(inlinkId) || this.pageRankScores.get(inlinkId) || 0;
                if (inlinkScore > 0) {
                    const inlinkNode = this.songGraph.get(inlinkId);
                    if (inlinkNode) {
                        const outlinksCount = Math.max(1, inlinkNode.outlinks.size);
                        score += this.dampingFactor * (inlinkScore / outlinksCount);
                    }
                }
            }
            
            // Apply metadata-based popularity boost
            score *= this.calculatePopularityBoost(node.metadata);
            
            updatedScores.set(nodeId, score);
        }
        
        return updatedScores;
    }

    calculatePopularityBoost(metadata) {
        let popularityBoost = 1.0;
        
        if (metadata.playCount > 0) {
            popularityBoost += Math.log(metadata.playCount + 1) * 0.08; // Reduced impact factor
        }
        
        if (metadata.searchCount > 0) {
            popularityBoost += Math.log(metadata.searchCount + 1) * 0.04;
        }
        
        // Apply recency boost for new songs
        const ageInDays = (Date.now() - (metadata.addedAt || 0)) / (24 * 60 * 60 * 1000);
        if (ageInDays < 7) {
            popularityBoost *= (1 + (7 - ageInDays) * 0.01);
        }
        
        return Math.min(popularityBoost, 2.0); // Cap the boost
    }

    calculateMaxChange(oldScores, newScores) {
        let maxChange = 0;
        
        for (const [nodeId, newScore] of newScores) {
            const oldScore = oldScores.get(nodeId) || 0;
            const change = Math.abs(newScore - oldScore);
            maxChange = Math.max(maxChange, change);
        }
        
        return maxChange;
    }

    scheduleIncrementalCalculation() {
        // Debounce incremental calculations
        clearTimeout(this.incrementalTimeout);
        this.incrementalTimeout = setTimeout(() => {
            if (!this.isCalculating && this.dirtyNodes.size > 0) {
                this.calculatePageRank(false);
            }
        }, 5000); // 5 second delay
    }

    getSongScore(songId) {
        // Check cache first
        if (this.scoreCache.has(songId)) {
            const cached = this.scoreCache.get(songId);
            if (Date.now() - cached.timestamp < this.scoreCacheTimeout) {
                return cached.score;
            }
        }
        
        const score = this.pageRankScores.get(songId) || 0;
        
        // Cache the score
        this.scoreCache.set(songId, {
            score,
            timestamp: Date.now()
        });
        
        return score;
    }

    clearScoreCache() {
        this.scoreCache.clear();
    }

    enhanceSearchResults(searchResults) {
        if (!searchResults || searchResults.length === 0) {
            return searchResults;
        }
        
        console.log(`[MusicPageRank] Enhancing ${searchResults.length} search results`);
        
        const enhancedResults = searchResults.map(result => {
            if (result.isError) return result;
            
            const songId = this.getSongId(result);
            const pageRankScore = this.getSongScore(songId);
            
            if (pageRankScore > 0) {
                const pageRankBoost = Math.min(75, Math.log(pageRankScore * 2000 + 1) * 12);
                result.confidence = (result.confidence || 0) + pageRankBoost;
                result.pageRankScore = pageRankScore;
                result.pageRankBoost = pageRankBoost;
            }
            
            // Add song to graph for future learning
            this.addSong(songId, {
                title: result.title,
                source: result.source,
                webpageUrl: result.webpageUrl
            });
            
            return result;
        });
        
        // Batch the search co-occurrence recording
        const resultSongIds = enhancedResults
            .filter(r => !r.isError)
            .map(r => this.getSongId(r));
        
        if (resultSongIds.length > 1) {
            this.pendingUpdates.push({
                type: 'search',
                query: 'search',
                songIds: resultSongIds
            });
        }
        
        return enhancedResults;
    }

    getSongId(result) {
        if (result.id) return result.id;
        if (result.webpageUrl) return result.webpageUrl;
        
        const normalizedTitle = result.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
        
        return `${result.source}_${normalizedTitle}`;
    }

    recordUserPlay(songId, metadata = {}) {
        this.addSong(songId, metadata);
        if (this.songGraph.has(songId)) {
            this.songGraph.get(songId).metadata.playCount++;
            this.markNodeDirty(songId);
        }
    }

    getGraphStats() {
        const songCount = this.songGraph.size;
        const relationshipCount = Array.from(this.songGraph.values())
            .reduce((total, node) => total + node.outlinks.size, 0);
        
        const topSongs = Array.from(this.pageRankScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([songId, score]) => ({
                songId,
                score: score.toFixed(6),
                metadata: this.songGraph.get(songId)?.metadata
            }));
        
        return {
            songCount,
            relationshipCount,
            topSongs,
            dirtyNodes: this.dirtyNodes.size,
            lastFullCalculation: new Date(this.lastFullCalculation).toISOString(),
            pendingUpdates: this.pendingUpdates.length,
            cacheSize: this.scoreCache.size
        };
    }

    schedulePeriodicUpdates() {
        setInterval(() => {
            if (this.songGraph.size > this.minGraphSizeForPageRank && this.dirtyNodes.size > 5) {
                this.calculatePageRank(false);
            }
        }, 30 * 60 * 1000); // 30 minutes
        
        setInterval(() => {
            if (this.songGraph.size > this.minGraphSizeForPageRank) {
                this.calculatePageRank(true);
            }
        }, 6 * 60 * 60 * 1000); // 6 hours
        
        setInterval(() => {
            this.saveGraph();
        }, 5 * 60 * 1000); // 5 minutes
        
        setInterval(() => {
            this.cleanupCache();
        }, 15 * 60 * 1000); // 15 minutes
    }

    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.scoreCache.entries()) {
            if (now - value.timestamp > this.scoreCacheTimeout) {
                this.scoreCache.delete(key);
            }
        }
    }

    cleanupGraph() {
        const now = Date.now();
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const minPlayCount = 1;
        
        const toRemove = [];
        
        for (const [songId, node] of this.songGraph.entries()) {
            const age = now - (node.metadata.addedAt || 0);
            const playCount = node.metadata.playCount || 0;
            const searchCount = node.metadata.searchCount || 0;
            
            // Conservative cleanup policy - preserve nodes with any activity
            if (age > maxAge && playCount < minPlayCount && searchCount === 0) {
                toRemove.push(songId);
            }
        }
        
        if (toRemove.length > 0) {
            console.log(`[MusicPageRank] Cleaning up ${toRemove.length} old song nodes`);
            
            for (const songId of toRemove) {
                this.removeSong(songId);
            }
            
            // Force recalculation after cleanup
            this.calculatePageRank(true);
        }
    }

    removeSong(songId) {
        const node = this.songGraph.get(songId);
        if (!node) return;
        
        // Remove from connected nodes
        for (const outlinkId of node.outlinks) {
            const outlinkNode = this.songGraph.get(outlinkId);
            if (outlinkNode) {
                outlinkNode.inlinks.delete(songId);
                this.markNodeDirty(outlinkId);
            }
        }
        
        for (const inlinkId of node.inlinks) {
            const inlinkNode = this.songGraph.get(inlinkId);
            if (inlinkNode) {
                inlinkNode.outlinks.delete(songId);
                this.markNodeDirty(inlinkId);
            }
        }
        
        // Clean up all references
        this.songGraph.delete(songId);
        this.pageRankScores.delete(songId);
        this.scoreCache.delete(songId);
        this.dirtyNodes.delete(songId);
    }

    // Batch operations for playlist/queue updates
    batchRecordPlaylistCooccurrence(songIds, playlistMetadata = {}) {
        this.pendingUpdates.push({
            type: 'playlist',
            songIds,
            metadata: playlistMetadata
        });
    }

    batchRecordQueueCooccurrence(songIds) {
        this.pendingUpdates.push({
            type: 'queue',
            songIds
        });
    }

    // Force immediate calculation for testing
    async forceCalculation() {
        await this.calculatePageRank(true);
    }
}

const musicPageRank = new MusicPageRank();

module.exports = {
    musicPageRank,
    MusicPageRank
}; 