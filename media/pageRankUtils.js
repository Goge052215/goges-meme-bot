const { musicPageRank } = require('./musicPageRank');
const { spotifyPageRankIntegration } = require('./spotifyPageRankIntegration');

/**
 * Utility functions for integrating PageRank with music bot operations
 */
class PageRankUtils {
    static recordSongPlay(songData, context = {}) {
        if (!songData) return;
        
        const songId = this.generateSongId(songData);
        
        // Record for general PageRank
        musicPageRank.recordUserPlay(songId, {
            title: songData.title || '',
            artist: songData.artist || '',
            source: songData.source || 'unknown',
            duration: songData.duration || 0,
            playContext: context.type || 'manual',
            guildId: context.guildId || '',
            userId: context.userId || '',
            playedAt: Date.now()
        });
        
        if (songData.source === 'spotify' || songData.spotifyUri) {
            const spotifyTrack = this.convertToSpotifyFormat(songData);
            if (spotifyTrack) {
                spotifyPageRankIntegration.recordSpotifyTrack(spotifyTrack, context);
            }
        }
        
        console.log(`[PageRank] Recorded play: ${songData.title} (${songData.source})`);
    }
    
    static recordQueueSequence(songs, context = {}) {
        if (!songs || songs.length < 2) return;
        
        console.log(`[PageRank] Recording queue sequence of ${songs.length} songs`);
        
        const songIds = songs.map(song => this.generateSongId(song));
        
        musicPageRank.batchRecordQueueCooccurrence(songIds);
        
        const spotifyTracks = songs
            .filter(song => song.source === 'spotify' || song.spotifyUri)
            .map(song => this.convertToSpotifyFormat(song))
            .filter(track => track);
        
        if (spotifyTracks.length > 1) {
            spotifyPageRankIntegration.recordListeningSession(spotifyTracks, {
                sessionType: 'queue',
                guildId: context.guildId,
                userId: context.userId,
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Record a playlist for PageRank learning
     */
    static recordPlaylist(playlistData, songs, context = {}) {
        if (!songs || songs.length < 2) return;
        
        console.log(`[PageRank] Recording playlist: ${playlistData.name} (${songs.length} songs)`);
        
        const songIds = songs.map(song => this.generateSongId(song));
        
        musicPageRank.batchRecordPlaylistCooccurrence(songIds, {
            playlistName: playlistData.name,
            playlistId: playlistData.id,
            isPublic: playlistData.public,
            source: playlistData.source || 'discord',
            createdBy: context.userId,
            guildId: context.guildId
        });
        
        const spotifyTracks = songs
            .filter(song => song.source === 'spotify' || song.spotifyUri)
            .map(song => this.convertToSpotifyFormat(song))
            .filter(track => track);
        
        if (spotifyTracks.length > 1) {
            spotifyPageRankIntegration.recordSpotifyPlaylist(playlistData, spotifyTracks);
        }
    }
    
    static async getPersonalizedRecommendations(userContext, seedSongs = [], limit = 10) {
        console.log(`[PageRank] Generating ${limit} personalized recommendations`);
        
        if (seedSongs.length === 0) {
            seedSongs = this.getUserTopSongs(userContext.userId, 3);
        }
        
        const spotifySeeds = seedSongs
            .filter(song => song.source === 'spotify' || song.spotifyUri)
            .map(song => this.convertToSpotifyFormat(song))
            .filter(track => track);
        
        if (spotifySeeds.length > 0) {
            return await spotifyPageRankIntegration.getPersonalizedRecommendations(
                spotifySeeds,
                userContext,
                limit
            );
        }
        
        return this.getGeneralRecommendations(seedSongs, limit);
    }
    
    /**
     * Optimize a queue/playlist order using PageRank scores
     */
    static optimizePlayOrder(songs, criteria = 'engagement') {
        if (!songs || songs.length < 2) return songs;
        
        console.log(`[PageRank] Optimizing play order for ${songs.length} songs (${criteria})`);
        
        const spotifyTracks = songs
            .filter(song => song.source === 'spotify' || song.spotifyUri)
            .map(song => this.convertToSpotifyFormat(song))
            .filter(track => track);
        
        if (spotifyTracks.length > 0) {
            const optimizedSpotify = spotifyPageRankIntegration.optimizePlaylistOrder(spotifyTracks, criteria);
            
            return songs.map(song => {
                if (song.source === 'spotify' || song.spotifyUri) {
                    const optimizedIndex = optimizedSpotify.findIndex(t => 
                        t.id === song.id || t.name === song.title?.split(' - ')[0]
                    );
                    return { ...song, optimizedScore: optimizedIndex !== -1 ? (100 - optimizedIndex) : 0 };
                }
                return { ...song, optimizedScore: this.getGeneralPageRankScore(song) };
            }).sort((a, b) => b.optimizedScore - a.optimizedScore);
        }
        
        return songs.map(song => ({
            ...song,
            optimizedScore: this.getGeneralPageRankScore(song)
        })).sort((a, b) => b.optimizedScore - a.optimizedScore);
    }
    
    static getAnalytics() {
        const generalStats = musicPageRank.getGraphStats();
        const spotifyStats = spotifyPageRankIntegration.getSpotifyAnalytics();
        
        return {
            general: generalStats,
            spotify: spotifyStats,
            combined: {
                totalSongs: generalStats.songCount,
                totalRelationships: generalStats.relationshipCount,
                spotifyIntegration: spotifyStats.integrationHealth,
                performance: {
                    dirtyNodes: generalStats.dirtyNodes,
                    pendingUpdates: generalStats.pendingUpdates,
                    cacheSize: generalStats.cacheSize
                }
            }
        };
    }
    
    static async forceRecalculation() {
        console.log('[PageRank] Forcing recalculation...');
        await musicPageRank.forceCalculation();
        console.log('[PageRank] Recalculation completed');
    }
    
    static generateSongId(songData) {
        if (songData.id) return songData.id;
        if (songData.webpageUrl) return songData.webpageUrl;
        
        const normalizedTitle = (songData.title || '')
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
        
        const source = songData.source || 'unknown';
        return `${source}_${normalizedTitle}`;
    }
    
    static convertToSpotifyFormat(songData) {
        if (!songData) return null;
        
        const titleParts = (songData.title || '').split(' - ');
        const name = titleParts[0] || songData.title || '';
        const artistName = titleParts[1] || songData.artist || 'Unknown';
        
        return {
            id: songData.id || songData.spotifyId,
            name: name,
            artists: [{ name: artistName }],
            album: { 
                name: songData.album || '',
                images: songData.thumbnail ? [{ url: songData.thumbnail }] : []
            },
            popularity: songData.popularity || 50,
            duration_ms: (songData.duration || songData.durationSeconds || 0) * 1000,
            uri: songData.spotifyUri,
            external_urls: { spotify: songData.webpageUrl || '' },
            explicit: songData.explicit || false
        };
    }
    
    /**
     * Get user's top songs from PageRank history
     */
    static getUserTopSongs(userId, limit = 5) {
        const stats = musicPageRank.getGraphStats();
        return stats.topSongs.slice(0, limit).map(song => ({
            id: song.songId,
            title: song.metadata?.title || 'Unknown',
            artist: song.metadata?.artist || 'Unknown',
            source: song.metadata?.source || 'unknown',
            pageRankScore: parseFloat(song.score)
        }));
    }
    
    static getGeneralPageRankScore(songData) {
        const songId = this.generateSongId(songData);
        return musicPageRank.getSongScore(songId) * 1000; // Scale for easier comparison
    }
    
    static recordSearchInteraction(query, results, selectedResult = null) {
        if (!results || results.length === 0) return;
        
        console.log(`[PageRank] Recording search interaction for: ${query}`);
        
        const resultIds = results.map(result => this.generateSongId(result));
        if (resultIds.length > 1) {
            setTimeout(() => {
                musicPageRank.recordSearchQuery(query, resultIds);
            }, 0);
        }
        
        if (selectedResult) {
            setTimeout(() => {
                this.recordSongPlay(selectedResult, {
                    type: 'search_selection',
                    searchQuery: query,
                    selectionBoost: true
                });
            }, 0);
        }
    }
}

module.exports = {
    PageRankUtils
}; 