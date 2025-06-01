const { 
    spotifyApiInstance, 
    getSpotifyTrackInfo, 
    isSpotifyUrl,
    searchTracks,
    addToQueue,
    startPlayback,
    getCurrentPlaybackState
} = require('./spotifyUtils');
const { isSoundCloudUrl, isYouTubeUrl } = require('./urlUtils');
const { cookieManager } = require('./cookieManager');
const { performanceMonitor } = require('./performanceMonitor');
const youtubeDl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const util = require('util');
const fetch = require('node-fetch');

const sleep = util.promisify(setTimeout);

// Utility function to format duration properly
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return null;
    
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Performance optimizations: Caching system
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

// Cleanup cache periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            searchCache.delete(key);
        }
    }
    
    // Limit cache size
    if (searchCache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(searchCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toDelete = entries.slice(0, entries.length - MAX_CACHE_SIZE);
        toDelete.forEach(([key]) => searchCache.delete(key));
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

function getCacheKey(query, sources, maxResults) {
    return `${query.toLowerCase().trim()}:${sources.sort().join(',')}:${maxResults}`;
}

function getCachedResult(cacheKey) {
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`🎯 Cache hit for search: ${cacheKey.split(':')[0]}`);
        performanceMonitor.recordCacheHit();
        return cached.results;
    }
    performanceMonitor.recordCacheMiss();
    return null;
}

function setCachedResult(cacheKey, results) {
    searchCache.set(cacheKey, {
        results: results,
        timestamp: Date.now()
    });
}

class AggregatedSearchResult {
    constructor(title, url, duration, thumbnail, source, originalQuery, id, confidence = 0, spotifyUri = null) {
        this.title = title;
        this.webpageUrl = url;
        this.duration = formatDuration(duration);
        this.durationSeconds = duration; // Keep raw seconds for calculations
        this.thumbnail = thumbnail;
        this.source = source;
        this.originalQuery = originalQuery;
        this.id = id || url;
        this.confidence = confidence;
        this.isError = false;
        this.spotifyUri = spotifyUri;
        
        this.canPlayDirectly = !!(
            spotifyUri ||
            (url && (
                url.includes('soundcloud.com') ||
                url.includes('youtube.com') ||
                url.includes('youtu.be') ||
                source.includes('SoundCloud') ||
                source.includes('YouTube')
            ))
        );
    }

    static createError(query, message) {
        const errorResult = new AggregatedSearchResult(
            query, null, null, null, 'error', query, null, 0
        );
        errorResult.isError = true;
        errorResult.errorMessage = message;
        return errorResult;
    }

    async playOnSpotify(deviceId = null) {
        if (!this.canPlayDirectly || !this.spotifyUri) {
            console.log(`❌ Cannot play "${this.title}" directly on Spotify - no URI available`);
            return false;
        }

        try {
            console.log(`🎵 Playing "${this.title}" directly on Spotify...`);
            const success = await startPlayback(this.spotifyUri, deviceId);
            
            if (success) {
                console.log(`✅ Now playing on Spotify: ${this.title}`);
            }
            
            return success;
        } catch (error) {
            console.log(`❌ Failed to play on Spotify: ${error.message}`);
            return false;
        }
    }

    async addToSpotifyQueue(deviceId = null) {
        if (!this.canPlayDirectly || !this.spotifyUri) {
            console.log(`❌ Cannot add "${this.title}" to Spotify queue - no URI available`);
            return false;
        }

        try {
            console.log(`🎵 Adding "${this.title}" to Spotify queue...`);
            const success = await addToQueue(this.spotifyUri, deviceId);
            
            if (success) {
                console.log(`✅ Added to Spotify queue: ${this.title}`);
            }
            
            return success;
        } catch (error) {
            console.log(`❌ Failed to add to Spotify queue: ${error.message}`);
            return false;
        }
    }

    async playDirectly(options = {}) {
        if (!this.canPlayDirectly) {
            console.log(`❌ Cannot play "${this.title}" directly - no playable source available`);
            return false;
        }

        if (this.spotifyUri) {
            return await this.playOnSpotify(options.deviceId);
        }

        if (this.webpageUrl) {
            console.log(`🎵 Starting stream for "${this.title}" from ${this.source}...`);
            
            return {
                type: 'stream',
                url: this.webpageUrl,
                title: this.title,
                source: this.source,
                duration: this.duration
            };
        }

        return false;
    }

    getPlaybackInfo() {
        return {
            canPlayDirectly: this.canPlayDirectly,
            hasSpotifyUri: !!this.spotifyUri,
            hasStreamUrl: !!this.webpageUrl,
            playbackType: this.spotifyUri ? 'spotify' : 'stream',
            source: this.source
        };
    }
}

async function aggregateMusicSearch(query, options = {}) {
    const startTime = Date.now();
    const originalQuery = query;
    
    performanceMonitor.recordSearchRequest();
    
    const opts = {
        timeout: 35000,
        sourceTimeout: 8000,
        maxResults: 10,
        sources: ['spotify', 'soundcloud'],
        prioritizeFallback: false,
        ...options
    };

    // Check cache first for non-URL queries
    if (!isSpotifyUrl(query) && !isSoundCloudUrl(query) && !isYouTubeUrl(query)) {
        const cacheKey = getCacheKey(query, opts.sources, opts.maxResults);
        const cachedResult = getCachedResult(cacheKey);
        if (cachedResult) {
            performanceMonitor.recordSearchTime(Date.now() - startTime);
            return cachedResult;
        }
    }

    console.log(`🎵 Spotify-focused search for "${query}"`);

    if (isSpotifyUrl(query)) {
        return await getSpotifyDirectResults(query, originalQuery);
    } else if (isSoundCloudUrl(query)) {
        return await getSoundCloudDirectResults(query, originalQuery);
    } else if (isYouTubeUrl(query)) {
        console.log('🔄 Converting YouTube URL to Spotify search...');
        const convertedQuery = await convertYouTubeUrlToQuery(query);
        return await aggregateMusicSearch(convertedQuery || query, options);
    }

    const searchPromises = [];
    let spotifyFailed = false;
    
    // Optimize: Run searches in parallel but prioritize Spotify
    if (opts.sources.includes('spotify')) {
        const spotifyPromise = searchWithTimeout(searchSpotify(query, originalQuery), opts.sourceTimeout, 'Spotify')
            .catch(error => {
                if (error.message.includes('timeout') || error.message.includes('ECONNRESET')) {
                    console.log('🚧 Spotify connectivity issues detected, prioritizing SoundCloud');
                    spotifyFailed = true;
                }
                return [];
            });
        searchPromises.push(spotifyPromise);
    }
    
    if (opts.sources.includes('soundcloud')) {
        searchPromises.push(searchWithTimeout(searchSoundCloud(query, originalQuery), 12000, 'SoundCloud')); // Reduced timeout
    }

    const settledResults = await Promise.allSettled(searchPromises);
    
    const allResults = [];
    
    settledResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && Array.isArray(result.value)) {
            if (spotifyFailed && index === 1) {
                result.value.forEach(item => {
                    if (!item.isError) {
                        item.confidence += 25;
                        item.source = item.source.replace('(Fallback)', '(Primary - Connectivity)');
                    }
                });
            }
            allResults.push(...result.value);
        } else if (result.status === 'rejected') {
            console.log(`Search source failed:`, result.reason?.message || 'Unknown error');
        }
    });
    
    if (allResults.length === 0) {
        console.log('No results from Spotify or SoundCloud, trying enhanced search...');
        
        // Skip enhanced Spotify search if we detected connectivity issues
        if (!spotifyFailed) {
            try {
                const enhancedResults = await getEnhancedSpotifySearch(originalQuery);
                if (enhancedResults && enhancedResults.length > 0) {
                    console.log(`✅ Enhanced Spotify search found ${enhancedResults.length} results`);
                    return enhancedResults;
                }
            } catch (fallbackError) {
                console.log('Enhanced Spotify search also failed:', fallbackError.message);
                spotifyFailed = true;
            }
        }
        
        // Try direct metadata search with emphasis on SoundCloud for China
        try {
            console.log('🔍 Trying direct metadata search as final fallback...');
            const directResults = await getDirectMetadataSearch(originalQuery, spotifyFailed);
            if (directResults && directResults.length > 0) {
                console.log(`✅ Direct metadata search found ${directResults.length} results`);
                return directResults;
            }
        } catch (directError) {
            console.log('Direct metadata search failed:', directError.message);
        }
        
        const errorMessage = spotifyFailed 
            ? `❌ No results found for "${originalQuery}". Spotify appears to be blocked or unstable in your region.`
            : `❌ No results found for "${originalQuery}" on any source.`;
            
        return [AggregatedSearchResult.createError(originalQuery, errorMessage)];
    }
    
    // Optimize: More efficient sorting and result processing
    const sortedResults = allResults
        .filter(result => !result.isError)
        .sort((a, b) => {
            const aSpotify = a.source.includes('Spotify');
            const bSpotify = b.source.includes('Spotify');
            if (aSpotify && !bSpotify) return -1;
            if (!aSpotify && bSpotify) return 1;
            return b.confidence - a.confidence;
        })
        .slice(0, opts.maxResults);
    
    console.log(`✅ Found ${sortedResults.length} results for "${originalQuery}"`);
    
    // Cache successful results
    if (!isSpotifyUrl(originalQuery) && !isSoundCloudUrl(originalQuery) && !isYouTubeUrl(originalQuery)) {
        const cacheKey = getCacheKey(originalQuery, opts.sources, opts.maxResults);
        setTimeout(() => setCachedResult(cacheKey, sortedResults), 0);
    }
    
    performanceMonitor.recordSearchTime(Date.now() - startTime);
    return sortedResults;
}

async function searchWithTimeout(promise, timeoutMs, sourceName) {
    return new Promise(async (resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
            console.log(`${sourceName} search timed out after ${timeoutMs}ms`);
            resolve([]);
        }, timeoutMs);
    
    try {
            const result = await promise;
        clearTimeout(timeoutHandle);
            resolve(result);
    } catch (error) {
        clearTimeout(timeoutHandle);
        console.log(`${sourceName} search error: ${error.message}`);
            resolve([]);
    }
    });
}

async function searchSpotify(query, originalQuery) {
    const spotifyInstance = spotifyApiInstance();
    if (!spotifyInstance) {
        console.log('Spotify API not initialized, skipping search');
        return [];
    }
    
    try {
        await spotifyInstance.getMe();
        console.log(`🎵 Searching Spotify for "${query}"`);
    } catch (tokenError) {
        if (tokenError.message.includes('ECONNRESET') || 
            tokenError.message.includes('ENOTFOUND') || 
            tokenError.message.includes('ETIMEDOUT') ||
            tokenError.message.includes('timeout') ||
            tokenError.message.includes('ECONNREFUSED')) {
            console.log('Spotify API token request failed due to network connectivity issues, skipping search');
        } else if (tokenError.statusCode === 401) {
            console.log('Spotify API authentication failed (invalid credentials), skipping search');
        } else {
            console.log(`Spotify API token validation failed: ${tokenError.message}, skipping search`);
        }
        return [];
    }
    
    try {
        const spotifyResults = await searchTracks(query, { limit: 15 });
        
        if (!spotifyResults.body?.tracks?.items?.length) {
            console.log(`No Spotify results for "${query}"`);
            return [];
        }
        
        console.log(`✅ Found ${spotifyResults.body.tracks.items.length} Spotify results`);
        
        return spotifyResults.body.tracks.items.map((track, index) => {
            const artists = track.artists.map(a => a.name).join(', ');
            const title = `${track.name} - ${artists}`;
            
            let confidence = 150 - (index * 3);
            
            if (track.name.toLowerCase().includes(query.toLowerCase()) ||
                artists.toLowerCase().includes(query.toLowerCase())) {
                confidence += 20;
            }
            
            if (track.popularity > 70) {
                confidence += 15;
            }
            
            return new AggregatedSearchResult(
                title,
                track.external_urls.spotify,
                Math.floor(track.duration_ms / 1000),
                track.album?.images?.[0]?.url,
                'Spotify (Primary)',
                originalQuery,
                track.id,
                Math.min(confidence, 200),
                track.uri
            );
        });
    } catch (error) {
        console.log(`Spotify search error: ${error.message}`);
        return [];
    }
}

async function searchSoundCloud(query, originalQuery) {
    try {
        console.log(`🔊 Searching SoundCloud for "${query}" (fallback)`);
        
        const cleanQuery = query.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
        const searchQueries = [
            `scsearch10:${cleanQuery}`,
            `scsearch15:"${cleanQuery}"`,
            `scsearch8:${cleanQuery.split(' ').slice(0, 3).join(' ')}`,
            `scsearch5:${cleanQuery.replace(/[^\w\s]/g, '')}`
        ];
        
        const baseScFlags = {
            dumpSingleJson: true,
            flatPlaylist: true,
            skipDownload: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
            ignoreErrors: true,
            format: 'bestaudio',
            socketTimeout: '20',
            playlistEnd: 10
        };
        
        for (const searchQuery of searchQueries) {
            try {
                console.log(`🔍 Trying SoundCloud search: "${searchQuery}"`);
                const scFlags = await cookieManager.getYtDlpFlags(baseScFlags);
                
                const execPromise = youtubeDl(searchQuery, scFlags);
        const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('SoundCloud search timeout after 15 seconds')), 15000);
        });
        
        const execResult = await Promise.race([execPromise, timeoutPromise]);
        
                if (!execResult) {
                    console.log(`No SoundCloud results from yt-dlp for "${searchQuery}"`);
                    continue;
                }
                
                let jsonData;
                if (typeof execResult === 'string') {
                    try {
                        jsonData = JSON.parse(execResult);
                    } catch (parseError) {
                        console.log('Failed to parse SoundCloud JSON response');
                        continue;
                    }
                } else {
                    jsonData = execResult;
                }
                
                let entries = [];
                if (jsonData.entries && Array.isArray(jsonData.entries)) {
                    entries = jsonData.entries;
                } else if (jsonData.title && jsonData.webpage_url) {
                    entries = [jsonData];
                }
                
                if (!entries.length) {
                    console.log(`No SoundCloud entries found for "${searchQuery}"`);
                    continue;
                }
                
                console.log(`✅ Found ${entries.length} SoundCloud results with "${searchQuery}"`);
                
                const results = entries
                    .filter(entry => entry.webpage_url || entry.url)
                    .filter(entry => entry.title && entry.title.length > 0)
                    .slice(0, 8)
                    .map((entry, index) => {
                        let confidence = 75 - (index * 3);
                        
                        if (entry.title && cleanQuery.toLowerCase().includes(entry.title.toLowerCase().split(' ')[0])) {
                            confidence += 10;
                        }
                        
                        if (entry.duration && entry.duration > 60) {
                            confidence += 5;
                        }
                
                return new AggregatedSearchResult(
                    entry.title || `SoundCloud Track ${index + 1}`,
                    entry.webpage_url || entry.url,
                    entry.duration,
                    entry.thumbnail,
                            'SoundCloud (Fallback)',
                    originalQuery,
                    entry.id || entry.webpage_url,
                            Math.max(confidence, 25)
                );
            });
        
                if (results.length > 0) {
        return results;
                }
                
            } catch (searchError) {
                console.log(`SoundCloud search attempt failed for "${searchQuery}": ${searchError.message}`);
                continue;
            }
        }
        
        console.log('All SoundCloud search attempts failed');
        return [];
        
    } catch (error) {
        console.log(`SoundCloud search failed: ${error.message}`);
        return [];
    }
}

/**
 * Handle direct Spotify URLs
 */
async function getSpotifyDirectResults(url, originalQuery) {
    try {
        console.log(`🎵 Processing direct Spotify URL: ${url}`);
        
        const spotifyInstance = spotifyApiInstance();
        if (!spotifyInstance) {
            throw new Error('Spotify API not initialized');
        }
        
        try {
            await spotifyInstance.getMe();
        } catch (tokenError) {
            throw new Error('Spotify API not configured (missing/invalid token)');
        }
        
        const trackId = isSpotifyUrl(url) 
            ? url.split('/track/')[1].split('?')[0]
            : url.split('/').pop().split('?')[0];
        
        if (!trackId) {
            throw new Error('Could not extract Spotify track ID');
        }
        
        const trackInfo = await getSpotifyTrackInfo(trackId);
        
        if (!trackInfo || !trackInfo.title) {
            throw new Error('Could not get Spotify track info');
        }
        
        return [new AggregatedSearchResult(
            trackInfo.title,
            trackInfo.external_url || url,
            trackInfo.duration,
            trackInfo.thumbnail,
            'Spotify (Direct)',
            originalQuery,
            trackId,
            200,
            trackInfo.spotify_uri
        )];
        
    } catch (error) {
        return [AggregatedSearchResult.createError(
            originalQuery, `❌ Error processing Spotify URL: ${error.message}`
        )];
    }
}

/**
 * Handle direct SoundCloud URLs
 */
async function getSoundCloudDirectResults(url, originalQuery) {
    try {
        console.log(`🔊 Processing direct SoundCloud URL: ${url}`);
        
        const baseScFlags = {
            dumpSingleJson: true,
            noWarnings: true,
            skipDownload: true,
            noCallHome: true,
            noCheckCertificate: true,
            ignoreErrors: true,
            format: 'bestaudio'
        };
        
        const scFlags = await cookieManager.getYtDlpFlags(baseScFlags);
        
        const execResult = await youtubeDl(url, scFlags);
        
        if (!execResult || typeof execResult !== 'string') {
            throw new Error('Empty SoundCloud result');
        }
        
        const trackData = JSON.parse(execResult);
        
        return [new AggregatedSearchResult(
            trackData.title,
            trackData.webpage_url || url,
            trackData.duration,
            trackData.thumbnail,
            'SoundCloud (Direct)',
            originalQuery,
            trackData.id,
            150,
            null
        )];
    } catch (error) {
        return [AggregatedSearchResult.createError(
            originalQuery, `❌ Error processing SoundCloud URL: ${error.message}`
        )];
    }
}

/**
 * Enhanced Spotify search with fuzzy matching and alternatives
 */
async function getEnhancedSpotifySearch(query) {
    console.log(`🔍 Enhanced Spotify search for "${query}"`);
    
    const spotifyInstance = spotifyApiInstance();
    if (!spotifyInstance) {
        console.log('Spotify API not initialized for enhanced search');
        return [];
    }
    
    try {
        await spotifyInstance.getMe();
        console.log('✅ Spotify API configured for enhanced search');
    } catch (tokenError) {
        console.log('Spotify API not configured for enhanced search (missing/invalid token)');
        return [];
    }
    
    const searchVariations = [
        query,
        query.replace(/[^\w\s]/g, ''),
        query.split(' ').slice(0, 3).join(' '),
        query.replace(/\b(official|video|audio|lyrics|ft|feat)\b/gi, '').trim()
    ];
    
    for (const variation of searchVariations) {
        try {
            console.log(`🎯 Trying Spotify search variation: "${variation}"`);
            const results = await searchSpotify(variation, query);
            if (results && results.length > 0) {
                console.log(`✅ Found ${results.length} results with variation: "${variation}"`);
                return results;
            }
        } catch (error) {
            console.log(`❌ Spotify variation failed: ${error.message}`);
        }
    }
    
    return [];
}

/**
 * Convert YouTube URL to searchable query by extracting video title
 */
async function convertYouTubeUrlToQuery(youtubeUrl) {
    try {
        console.log(`🔄 Converting YouTube URL: ${youtubeUrl}`);
        
        const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
        if (!videoId) {
            console.log('❌ Could not extract video ID from YouTube URL');
            return null;
        }
        
        try {
            const metadata = await youtubeDl(youtubeUrl, {
                dumpSingleJson: true,
                noWarnings: true,
                skipDownload: true,
                quiet: true
            });
            
            if (metadata && metadata.title) {
                const cleanTitle = metadata.title
                    .replace(/\b(official|video|audio|lyrics|hd|4k)\b/gi, '')
                    .replace(/[^\w\s-]/g, '')
                    .trim();
                
                console.log(`✅ Converted YouTube URL to query: "${cleanTitle}"`);
                return cleanTitle;
            }
        } catch (ytError) {
            console.log(`❌ Could not extract title from YouTube: ${ytError.message}`);
        }
        
        return `video ${videoId}`;
        
    } catch (error) {
        console.log(`❌ YouTube URL conversion failed: ${error.message}`);
        return null;
    }
}

/**
 * Helper to capitalize words in a string
 */
function capitalizeWords(str) {
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Direct metadata search as final fallback
 * Tries multiple search approaches when primary sources fail
 */
async function getDirectMetadataSearch(query, spotifyFailed = false) {
    console.log(`🔍 Direct metadata search for "${query}"`);
    
    const cleanQuery = query.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
    
    const searchAttempts = spotifyFailed ? [
        `scsearch5:${cleanQuery}`,
        `scsearch3:"${cleanQuery}"`,
        `ytsearch3:${cleanQuery}`,
        `scsearch3:${cleanQuery} music`
    ] : [
        `ytsearch5:${cleanQuery}`,
        `scsearch3:${cleanQuery}`,
        `ytsearch3:"${cleanQuery}"`,
        `ytsearch5:${cleanQuery} music`
    ];
    
    if (spotifyFailed) {
        console.log('🎵 Prioritizing SoundCloud due to Spotify connectivity issues');
    }
    
    for (const searchAttempt of searchAttempts) {
        try {
            console.log(`🔍 Trying direct search: "${searchAttempt}"`);
            
            const baseFlags = {
                dumpSingleJson: true,
                flatPlaylist: true,
                skipDownload: true,
                noWarnings: true,
                noCallHome: true,
                noCheckCertificate: true,
                ignoreErrors: true,
                format: 'bestaudio',
                socketTimeout: '20',
                playlistEnd: 5
            };
            
            const flags = await cookieManager.getYtDlpFlags(baseFlags);
            
            const execPromise = youtubeDl(searchAttempt, flags);
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Direct search timeout')), 18000);
            });
            
            const execResult = await Promise.race([execPromise, timeoutPromise]);
            
            if (!execResult) {
                console.log(`No results from direct search: "${searchAttempt}"`);
                continue;
            }
            
            let jsonData;
            if (typeof execResult === 'string') {
                try {
                    jsonData = JSON.parse(execResult);
                } catch (parseError) {
                    console.log('Failed to parse direct search JSON response');
                    continue;
                }
            } else {
                jsonData = execResult;
            }
            
            let entries = [];
            if (jsonData.entries && Array.isArray(jsonData.entries)) {
                entries = jsonData.entries;
            } else if (jsonData.title && jsonData.webpage_url) {
                entries = [jsonData];
            }
            
            if (!entries.length) {
                console.log(`No entries from direct search: "${searchAttempt}"`);
                continue;
            }
            
            console.log(`✅ Found ${entries.length} results from direct search`);
            
            const results = entries
                .filter(entry => entry.webpage_url || entry.url)
                .filter(entry => entry.title && entry.title.length > 0)
                .slice(0, 3)
                .map((entry, index) => {
                    let confidence = spotifyFailed ? 65 - (index * 3) : 50 - (index * 5);
                    
                    if (entry.title.toLowerCase().match(/\b(music|song|track|audio)\b/)) {
                        confidence += 10;
                    }
                    
                    if (entry.duration && entry.duration > 120) {
                        confidence += 8;
                    }
                    
                    const isSoundCloud = searchAttempt.includes('scsearch');
                    if (spotifyFailed && isSoundCloud) {
                        confidence += 15;
                    }
                    
                    const source = isSoundCloud 
                        ? (spotifyFailed ? 'SoundCloud (Primary - Connectivity)' : 'SoundCloud (Direct)')
                        : 'YouTube (Direct)';
                    
                    return new AggregatedSearchResult(
                        entry.title,
                        entry.webpage_url || entry.url,
                        entry.duration,
                        entry.thumbnail,
                        source,
                        query,
                        entry.id || entry.webpage_url,
                        Math.max(confidence, 15)
                    );
                });
            
            if (results.length > 0) {
                return results;
            }
            
        } catch (error) {
            console.log(`Direct search attempt failed for "${searchAttempt}": ${error.message}`);
            continue;
        }
    }
    
    console.log('All direct search attempts failed');
    return [];
}

module.exports = {
    aggregateMusicSearch,
    AggregatedSearchResult
}; 