const { musicPageRank } = require('./musicPageRank');

class SpotifyPageRankIntegration {
    constructor() {
        this.spotifyTrackCache = new Map();
        this.playlistGraph = new Map();
        this.userPreferenceWeights = {
            recentPlay: 1.2,
            frequentPlay: 1.5,
            playlistPosition: 1.1,
            skipRate: 0.7,
            albumCohesion: 0.8
        };
    }

    /**
     * Enhanced Spotify search using PageRank scores
     */
    async enhanceSpotifySearchResults(searchQuery, spotifyResults, userContext = {}) {
        console.log(`[SpotifyPageRank] Enhancing ${spotifyResults.length} Spotify results for: "${searchQuery}"`);
        
        const enhancedResults = spotifyResults.map(track => {
            const songId = this.getSpotifyTrackId(track);
            const pageRankScore = musicPageRank.getSongScore(songId);
            
            // Calculate contextual boost based on user history
            const contextualBoost = this.calculateContextualBoost(track, userContext);
            
            // Apply PageRank enhancement
            if (pageRankScore > 0) {
                const baseBoost = Math.min(100, Math.log(pageRankScore * 3000 + 1) * 15);
                const totalBoost = baseBoost * contextualBoost;
                
                track.confidence = (track.confidence || track.popularity || 50) + totalBoost;
                track.pageRankScore = pageRankScore;
                track.pageRankBoost = totalBoost;
                track.contextualMultiplier = contextualBoost;
            }
            
            // Record track for future learning
            this.recordSpotifyTrack(track, userContext);
            
            return track;
        });

        // Record search patterns for PageRank learning
        this.recordSpotifySearchPattern(searchQuery, enhancedResults);
        
        // Sort by enhanced confidence
        return enhancedResults.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    }

    /**
     * Record Spotify playlist for PageRank learning
     */
    recordSpotifyPlaylist(playlistData, tracks) {
        if (!tracks || tracks.length < 2) return;
        
        console.log(`[SpotifyPageRank] Recording Spotify playlist: ${playlistData.name} (${tracks.length} tracks)`);
        
        const trackIds = tracks.map(track => this.getSpotifyTrackId(track));
        
        // Add playlist metadata to PageRank
        const playlistMetadata = {
            source: 'spotify',
            playlistId: playlistData.id,
            playlistName: playlistData.name,
            collaborative: playlistData.collaborative,
            public: playlistData.public,
            followers: playlistData.followers?.total || 0
        };

        // Record individual tracks with enhanced metadata
        tracks.forEach((track, index) => {
            const songId = this.getSpotifyTrackId(track);
            musicPageRank.addSong(songId, {
                title: track.name,
                artist: track.artists?.map(a => a.name).join(', ') || '',
                album: track.album?.name || '',
                source: 'spotify',
                spotifyId: track.id,
                popularity: track.popularity || 0,
                explicit: track.explicit || false,
                durationMs: track.duration_ms || 0,
                playlistPosition: index,
                playlistMetadata
            });
        });

        // Use batch recording for better performance
        musicPageRank.batchRecordPlaylistCooccurrence(trackIds, playlistMetadata);
    }

    /**
     * Record user listening session for enhanced recommendations
     */
    recordListeningSession(sessionTracks, sessionMetadata = {}) {
        if (!sessionTracks || sessionTracks.length < 2) return;
        
        console.log(`[SpotifyPageRank] Recording listening session (${sessionTracks.length} tracks)`);
        
        const trackIds = sessionTracks.map(track => this.getSpotifyTrackId(track));
        
        // Apply temporal weights - recent plays matter more
        const now = Date.now();
        sessionTracks.forEach((track, index) => {
            const songId = this.getSpotifyTrackId(track);
            const timeWeight = Math.max(0.5, 1.0 - (index * 0.05)); // Decay over session
            
            // Record play with enhanced metadata
            musicPageRank.recordUserPlay(songId, {
                title: track.name,
                artist: track.artists?.map(a => a.name).join(', ') || '',
                source: 'spotify',
                sessionPosition: index,
                timeWeight,
                sessionMetadata,
                playedAt: now - (index * 30000) // Approximate play times
            });
        });

        // Record queue co-occurrence
        musicPageRank.batchRecordQueueCooccurrence(trackIds);
    }

    /**
     * Get personalized Spotify recommendations using PageRank
     */
    async getPersonalizedRecommendations(seedTracks, userProfile = {}, limit = 20) {
        console.log(`[SpotifyPageRank] Generating personalized recommendations from ${seedTracks.length} seed tracks`);
        
        const seedTrackIds = seedTracks.map(track => this.getSpotifyTrackId(track));
        const recommendations = new Map();
        
        // Find connected tracks through PageRank graph
        for (const seedId of seedTrackIds) {
            const seedNode = musicPageRank.songGraph.get(seedId);
            if (!seedNode) continue;
            
            // Get tracks connected to seed
            for (const connectedId of [...seedNode.outlinks, ...seedNode.inlinks]) {
                const connectedNode = musicPageRank.songGraph.get(connectedId);
                if (!connectedNode || seedTrackIds.includes(connectedId)) continue;
                
                const score = musicPageRank.getSongScore(connectedId);
                const connectionStrength = this.calculateConnectionStrength(seedId, connectedId);
                const personalizedScore = score * connectionStrength * this.calculateUserPreferenceMultiplier(connectedNode.metadata, userProfile);
                
                if (personalizedScore > 0.001) {
                    recommendations.set(connectedId, {
                        songId: connectedId,
                        score: personalizedScore,
                        metadata: connectedNode.metadata,
                        connectedTo: seedId
                    });
                }
            }
        }
        
        // Sort and return top recommendations
        const sortedRecommendations = Array.from(recommendations.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        
        console.log(`[SpotifyPageRank] Generated ${sortedRecommendations.length} personalized recommendations`);
        return sortedRecommendations;
    }

    /**
     * Optimize playlist ordering using PageRank scores
     */
    optimizePlaylistOrder(tracks, optimizationCriteria = 'engagement') {
        console.log(`[SpotifyPageRank] Optimizing playlist order for ${tracks.length} tracks (criteria: ${optimizationCriteria})`);
        
        const trackScores = tracks.map(track => {
            const songId = this.getSpotifyTrackId(track);
            const pageRankScore = musicPageRank.getSongScore(songId);
            
            let optimizedScore = pageRankScore;
            
            switch (optimizationCriteria) {
                case 'discovery':
                    // Boost newer, less popular tracks
                    optimizedScore *= (1 + (1 / Math.max(track.popularity || 50, 1)));
                    break;
                case 'energy':
                    // Optimize for energy flow (would need Spotify audio features)
                    optimizedScore *= this.calculateEnergyFlow(track, tracks);
                    break;
                case 'engagement':
                default:
                    // Standard PageRank-based optimization
                    break;
            }
            
            return {
                track,
                songId,
                score: optimizedScore,
                originalIndex: tracks.indexOf(track)
            };
        });
        
        return trackScores
            .sort((a, b) => b.score - a.score)
            .map(item => item.track);
    }

    /**
     * Calculate contextual boost based on user behavior
     */
    calculateContextualBoost(track, userContext) {
        let boost = 1.0;
        
        // Boost based on recent listening history
        if (userContext.recentTracks) {
            const recentArtists = userContext.recentTracks.map(t => t.artists?.[0]?.name);
            if (recentArtists.includes(track.artists?.[0]?.name)) {
                boost *= this.userPreferenceWeights.recentPlay;
            }
        }
        
        // Boost based on frequently played artists
        if (userContext.topArtists) {
            const topArtistNames = userContext.topArtists.map(a => a.name);
            if (topArtistNames.includes(track.artists?.[0]?.name)) {
                boost *= this.userPreferenceWeights.frequentPlay;
            }
        }
        
        // Boost based on saved tracks
        if (userContext.savedTracks && userContext.savedTracks.some(t => t.id === track.id)) {
            boost *= 1.3;
        }
        
        // Temporal boost for newer releases
        if (track.album?.release_date) {
            const releaseDate = new Date(track.album.release_date);
            const ageInDays = (Date.now() - releaseDate.getTime()) / (24 * 60 * 60 * 1000);
            if (ageInDays < 30) {
                boost *= (1 + (30 - ageInDays) * 0.01);
            }
        }
        
        return Math.min(boost, 2.5); // Cap the boost
    }

    /**
     * Calculate connection strength between two tracks
     */
    calculateConnectionStrength(fromTrackId, toTrackId) {
        const fromNode = musicPageRank.songGraph.get(fromTrackId);
        const toNode = musicPageRank.songGraph.get(toTrackId);
        
        if (!fromNode || !toNode) return 0;
        
        let strength = 0;
        
        // Direct connection
        if (fromNode.outlinks.has(toTrackId)) {
            strength += 1.0;
        }
        
        // Bidirectional connection
        if (fromNode.inlinks.has(toTrackId) && fromNode.outlinks.has(toTrackId)) {
            strength += 0.5;
        }
        
        // Artist similarity
        const fromArtist = fromNode.metadata?.artist || '';
        const toArtist = toNode.metadata?.artist || '';
        if (fromArtist && toArtist && fromArtist === toArtist) {
            strength += 0.3;
        }
        
        return Math.min(strength, 2.0);
    }

    /**
     * Calculate user preference multiplier
     */
    calculateUserPreferenceMultiplier(trackMetadata, userProfile) {
        let multiplier = 1.0;
        
        // Genre preferences
        if (userProfile.topGenres && trackMetadata.genre) {
            if (userProfile.topGenres.includes(trackMetadata.genre)) {
                multiplier *= 1.2;
            }
        }
        
        // Explicit content preference
        if (userProfile.explicitFilter === false && trackMetadata.explicit) {
            multiplier *= 0.5;
        }
        
        // Duration preference
        if (userProfile.preferredDuration && trackMetadata.durationMs) {
            const preferredMs = userProfile.preferredDuration * 1000;
            const durationDiff = Math.abs(trackMetadata.durationMs - preferredMs);
            const durationPenalty = Math.min(0.5, durationDiff / (preferredMs * 2));
            multiplier *= (1 - durationPenalty);
        }
        
        return multiplier;
    }

    /**
     * Calculate energy flow for playlist optimization
     */
    calculateEnergyFlow(track, allTracks) {
        // This would ideally use Spotify's audio features
        // For now, use popularity as a proxy for energy
        const trackIndex = allTracks.indexOf(track);
        const popularity = track.popularity || 50;
        
        // Prefer varied energy levels
        let energyScore = 1.0;
        
        if (trackIndex > 0) {
            const prevPopularity = allTracks[trackIndex - 1].popularity || 50;
            const energyDiff = Math.abs(popularity - prevPopularity);
            energyScore += energyDiff / 100; // Reward energy changes
        }
        
        return energyScore;
    }

    /**
     * Record Spotify search pattern
     */
    recordSpotifySearchPattern(query, results) {
        const resultIds = results
            .filter(track => track.id)
            .slice(0, 10) // Top 10 results
            .map(track => this.getSpotifyTrackId(track));
        
        if (resultIds.length > 1) {
            setTimeout(() => {
                musicPageRank.recordSearchQuery(query, resultIds);
            }, 100);
        }
    }

    /**
     * Record individual Spotify track
     */
    recordSpotifyTrack(track, context = {}) {
        const songId = this.getSpotifyTrackId(track);
        
        musicPageRank.addSong(songId, {
            title: track.name,
            artist: track.artists?.map(a => a.name).join(', ') || '',
            album: track.album?.name || '',
            source: 'spotify',
            spotifyId: track.id,
            popularity: track.popularity || 0,
            explicit: track.explicit || false,
            durationMs: track.duration_ms || 0,
            searchContext: context.searchQuery || '',
            userContext: context.userId || ''
        });
    }

    /**
     * Generate consistent Spotify track ID
     */
    getSpotifyTrackId(track) {
        if (track.id) {
            return `spotify_${track.id}`;
        }
        
        // Fallback to name-based ID
        const normalizedName = track.name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100);
        
        const artistName = track.artists?.[0]?.name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50) || 'unknown';
        
        return `spotify_${artistName}_${normalizedName}`;
    }

    /**
     * Get analytics for Spotify integration
     */
    getSpotifyAnalytics() {
        const stats = musicPageRank.getGraphStats();
        
        const spotifySongs = Array.from(musicPageRank.songGraph.entries())
            .filter(([id, node]) => id.startsWith('spotify_'))
            .length;
        
        const topSpotifyTracks = Array.from(musicPageRank.pageRankScores.entries())
            .filter(([id]) => id.startsWith('spotify_'))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id, score]) => ({
                trackId: id,
                score: score.toFixed(6),
                metadata: musicPageRank.songGraph.get(id)?.metadata
            }));
        
        return {
            ...stats,
            spotifySongs,
            topSpotifyTracks,
            integrationHealth: spotifySongs > 0 ? 'active' : 'inactive'
        };
    }
}

const spotifyPageRankIntegration = new SpotifyPageRankIntegration();

module.exports = {
    spotifyPageRankIntegration,
    SpotifyPageRankIntegration
}; 