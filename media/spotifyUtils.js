require('dotenv').config({ path: './config.env' });
if (!process.env.SPOTIFY_CLIENT_ID) {
require('dotenv').config({ path: '../config.env' });
}
const SpotifyWebApi = require('spotify-web-api-node');

let spotifyApiInstance = null;
// User token storage (in production, use a database)
const userTokens = new Map();
const tokenRefreshTimers = new Map();

console.log('🔍 Checking Spotify credentials...');
console.log(`SPOTIFY_CLIENT_ID: ${process.env.SPOTIFY_CLIENT_ID ? 'Set (' + process.env.SPOTIFY_CLIENT_ID.length + ' chars)' : 'Not set'}`);
console.log(`SPOTIFY_CLIENT_SECRET: ${process.env.SPOTIFY_CLIENT_SECRET ? 'Set (' + process.env.SPOTIFY_CLIENT_SECRET.length + ' chars)' : 'Not set'}`);

if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    const initSuccess = initializeSpotifyApi();
    if (initSuccess) {
        console.log('Spotify API auto-initialized on module load');
        getClientCredentialsToken().then(tokenSuccess => {
            if (tokenSuccess) {
                console.log('Spotify client credentials token obtained automatically');
            } else {
                console.log('Could not obtain Spotify client credentials token');
            }
        });
    } else {
        console.log('Spotify API initialization failed');
    }
} else {
    console.log('Spotify credentials not found in environment variables');
}

function initializeSpotifyApi() {
    try {
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'https://gogesbot.workers.dev/spotify/callback';
        
        spotifyApiInstance = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: redirectUri
        });

        console.log('Spotify API initialized successfully with OAuth support');
        console.log(`Redirect URI: ${redirectUri}`);
        return true;
    } catch (error) {
        console.error('Failed to initialize Spotify API:', error.message);
        return false;
    }
}

// OAuth-related functions
function generateAuthUrl(userId, state = null) {
    if (!spotifyApiInstance) {
        throw new Error('Spotify API not initialized');
    }
    
    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'user-read-currently-playing',
        'playlist-read-private',
        'playlist-read-collaborative',
        'playlist-modify-public',
        'playlist-modify-private',
        'user-library-read',
        'user-library-modify',
        'user-read-private',
        'user-read-email'
    ];
    
    const finalState = state || `${userId}_${Date.now()}`;
    
    const authUrl = spotifyApiInstance.createAuthorizeURL(scopes, finalState, true);
    console.log(`Generated auth URL for user ${userId}: ${authUrl}`);
    
    return { authUrl, state: finalState };
}

async function handleAuthCallback(code, state) {
    if (!spotifyApiInstance) {
        throw new Error('Spotify API not initialized');
    }
    
    try {
        console.log('Exchanging authorization code for tokens...');
        const data = await spotifyApiInstance.authorizationCodeGrant(code);
        
        const accessToken = data.body.access_token;
        const refreshToken = data.body.refresh_token;
        const expiresIn = data.body.expires_in;
        
        // Get user ID from state or fetch user profile
        let userId = state ? state.split('_')[0] : null;
        
        if (!userId) {
            // Create a temporary instance to get user ID
            const tempApi = new SpotifyWebApi();
            tempApi.setAccessToken(accessToken);
            const userProfile = await tempApi.getMe();
            userId = userProfile.body.id;
        }
        
        // Store user tokens
        const tokenData = {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000),
            spotifyUserId: userId
        };
        
        userTokens.set(userId, tokenData);
        scheduleTokenRefresh(userId, expiresIn);
        
        console.log(`✅ Stored tokens for user ${userId}`);
        return { success: true, userId, tokenData };
        
    } catch (error) {
        console.error('OAuth callback failed:', error.message);
        return { success: false, error: error.message };
    }
}

function scheduleTokenRefresh(userId, expiresIn) {
    // Clear existing timer
    if (tokenRefreshTimers.has(userId)) {
        clearTimeout(tokenRefreshTimers.get(userId));
    }
    
    // Schedule refresh 5 minutes before expiry
    const refreshTime = (expiresIn - 300) * 1000;
    const timer = setTimeout(() => {
        refreshUserToken(userId);
    }, refreshTime);
    
    tokenRefreshTimers.set(userId, timer);
    console.log(`Scheduled token refresh for user ${userId} in ${refreshTime / 1000}s`);
}

async function refreshUserToken(userId) {
    const userData = userTokens.get(userId);
    if (!userData || !userData.refreshToken) {
        console.log(`No refresh token found for user ${userId}`);
        return false;
    }
    
    try {
        console.log(`Refreshing token for user ${userId}...`);
        spotifyApiInstance.setRefreshToken(userData.refreshToken);
        const data = await spotifyApiInstance.refreshAccessToken();
        
        const newAccessToken = data.body.access_token;
        const expiresIn = data.body.expires_in;
        const newRefreshToken = data.body.refresh_token || userData.refreshToken;
        
        userData.accessToken = newAccessToken;
        userData.refreshToken = newRefreshToken;
        userData.expiresAt = Date.now() + (expiresIn * 1000);
        
        userTokens.set(userId, userData);
        scheduleTokenRefresh(userId, expiresIn);
        
        console.log(`✅ Refreshed token for user ${userId}`);
        return true;
        
    } catch (error) {
        console.error(`Failed to refresh token for user ${userId}:`, error.message);
        userTokens.delete(userId);
        return false;
    }
}

function getUserApi(userId) {
    const userData = userTokens.get(userId);
    if (!userData) {
        return null;
    }
    
    // Check if token is expired
    if (Date.now() >= userData.expiresAt) {
        console.log(`Token expired for user ${userId}, attempting refresh...`);
        refreshUserToken(userId);
        return null;
    }
    
    const userApi = new SpotifyWebApi({
        clientId: process.env.SPOTIFY_CLIENT_ID,
        clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    });
    
    userApi.setAccessToken(userData.accessToken);
    return userApi;
}

function isUserAuthenticated(userId) {
    const userData = userTokens.get(userId);
    return userData && Date.now() < userData.expiresAt;
}

function revokeUserAuth(userId) {
    if (tokenRefreshTimers.has(userId)) {
        clearTimeout(tokenRefreshTimers.get(userId));
        tokenRefreshTimers.delete(userId);
    }
    
    const removed = userTokens.delete(userId);
    console.log(`${removed ? 'Revoked' : 'No tokens found for'} user ${userId}`);
    return removed;
}

// Enhanced user-specific functions
async function getUserPlaylists(userId, options = {}) {
    const userApi = getUserApi(userId);
    if (!userApi) {
        throw new Error('User not authenticated');
    }
    
    try {
        const response = await userApi.getUserPlaylists({ limit: 50, ...options });
        return response.body.items;
    } catch (error) {
        console.error(`Failed to get playlists for user ${userId}:`, error.message);
        throw error;
    }
}

async function getUserCurrentPlayback(userId) {
    const userApi = getUserApi(userId);
    if (!userApi) {
        throw new Error('User not authenticated');
    }
    
    try {
        const response = await userApi.getMyCurrentPlaybackState();
        return response.body;
    } catch (error) {
        if (error.statusCode === 204) {
            return null; // No active device
        }
        console.error(`Failed to get playback state for user ${userId}:`, error.message);
        throw error;
    }
}

async function controlUserPlayback(userId, action, params = {}) {
    const userApi = getUserApi(userId);
    if (!userApi) {
        throw new Error('User not authenticated');
    }
    
    try {
        switch (action) {
            case 'play':
                if (params.uris) {
                    await userApi.play({ uris: params.uris, device_id: params.deviceId });
                } else {
                    await userApi.play({ device_id: params.deviceId });
                }
                break;
            case 'pause':
                await userApi.pause({ device_id: params.deviceId });
                break;
            case 'next':
                await userApi.skipToNext({ device_id: params.deviceId });
                break;
            case 'previous':
                await userApi.skipToPrevious({ device_id: params.deviceId });
                break;
            case 'volume':
                await userApi.setVolume(params.volume, { device_id: params.deviceId });
                break;
            case 'shuffle':
                await userApi.setShuffle(params.state, { device_id: params.deviceId });
                break;
            case 'repeat':
                await userApi.setRepeat(params.state, { device_id: params.deviceId });
                break;
            default:
                throw new Error(`Unknown playback action: ${action}`);
        }
        return true;
    } catch (error) {
        console.error(`Playback control failed for user ${userId}:`, error.message);
        throw error;
    }
}

async function addToUserQueue(userId, uri, deviceId = null) {
    const userApi = getUserApi(userId);
    if (!userApi) {
        throw new Error('User not authenticated');
    }
    
    try {
        await userApi.addToQueue(uri, { device_id: deviceId });
        return true;
    } catch (error) {
        console.error(`Failed to add to queue for user ${userId}:`, error.message);
        throw error;
    }
}

async function getUserDevices(userId) {
    const userApi = getUserApi(userId);
    if (!userApi) {
        throw new Error('User not authenticated');
    }
    
    try {
        const response = await userApi.getMyDevices();
        return response.body.devices;
    } catch (error) {
        console.error(`Failed to get devices for user ${userId}:`, error.message);
        throw error;
    }
}

function setAccessToken(token) {
    if (spotifyApiInstance) {
        spotifyApiInstance.setAccessToken(token);
        console.log('🔑 Spotify access token set');
    }
}

async function searchTracks(query, options = {}) {
    try {
        const searchOptions = {
            limit: 20,
            ...options
        };
        
        console.log(`🔍 Searching Spotify for: "${query}"`);
        const response = await spotifyApiInstance.searchTracks(query, searchOptions);
        
        console.log(`✅ Found ${response.body.tracks.items.length} tracks`);
        return response;
    } catch (error) {
        console.log(`❌ Spotify search failed: ${error.message}`);
        throw error;
    }
}

function getSpotifyTrackId(url) {
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

function isSpotifyUrl(url) {
    return url && url.includes('spotify.com/track/');
}

async function getSpotifyTrackInfo(trackId) {
    try {
        const response = await spotifyApiInstance.getTrack(trackId);
        const track = response.body;
        
        return {
            title: `${track.name} - ${track.artists.map(a => a.name).join(', ')}`,
            duration: Math.floor(track.duration_ms / 1000),
            thumbnail: track.album.images[0]?.url,
            artist: track.artists.map(a => a.name).join(', '),
            album: track.album.name,
            spotify_uri: track.uri,
            external_url: track.external_urls.spotify
        };
    } catch (error) {
        console.log(`Failed to get Spotify track info: ${error.message}`);
        return null;
    }
}

async function getClientCredentialsToken(retryCount = 0) {
    if (!spotifyApiInstance) {
        console.log('Spotify API not initialized');
        return false;
    }
    
    try {
        console.log('Getting Spotify client credentials token...');
        
        const response = await spotifyApiInstance.clientCredentialsGrant();
        
        if (response.body && response.body.access_token) {
            spotifyApiInstance.setAccessToken(response.body.access_token);
            console.log('Spotify client credentials token set successfully');
            
            const expiresIn = response.body.expires_in || 3600;
            setTimeout(() => {
                console.log('Refreshing Spotify client credentials token...');
                getClientCredentialsToken();
            }, (expiresIn - 600) * 1000);
            
            return true;
        }
    } catch (error) {
        console.log(`Failed to get client credentials token: ${error.message}`);
        
        const isNetworkError = error.message.includes('ECONNRESET') || 
                              error.message.includes('ENOTFOUND') || 
                              error.message.includes('ETIMEDOUT') ||
                              error.message.includes('timeout') ||
                              error.message.includes('ECONNREFUSED') ||
                              error.message.includes('socket hang up');
        
        if (isNetworkError && retryCount < 3) {
            const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
            console.log(`Network connectivity issue detected. Retrying Spotify token request in ${delay/1000}s (attempt ${retryCount + 1}/4)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await getClientCredentialsToken(retryCount + 1);
        }
        
        if (isNetworkError) {
            console.log('Spotify API appears to be blocked or unstable (possible Great Firewall interference)');
            console.log('Bot will rely on SoundCloud fallback for music search');
        }
        
        return false;
    }
    
    return false;
}

// Legacy compatibility functions
async function addToQueue(uri, deviceId) {
    console.warn('addToQueue: Use addToUserQueue with userId instead');
    throw new Error('User authentication required for queue operations');
}

async function startPlayback(uri, deviceId) {
    console.warn('startPlayback: Use controlUserPlayback with userId instead');
    throw new Error('User authentication required for playback control');
}

async function getCurrentPlaybackState() {
    console.warn('getCurrentPlaybackState: Use getUserCurrentPlayback with userId instead');
    throw new Error('User authentication required for playback state');
}

module.exports = {
    initializeSpotifyApi,
    setAccessToken,
    getClientCredentialsToken,
    spotifyApiInstance: () => spotifyApiInstance,
    
    // OAuth functions
    generateAuthUrl,
    handleAuthCallback,
    refreshUserToken,
    getUserApi,
    isUserAuthenticated,
    revokeUserAuth,
    
    // User-specific functions
    getUserPlaylists,
    getUserCurrentPlayback,
    controlUserPlayback,
    addToUserQueue,
    getUserDevices,
    
    // Search functions (public)
    searchTracks,
    getSpotifyTrackId,
    isSpotifyUrl,
    getSpotifyTrackInfo,
    
    // Legacy compatibility (deprecated)
    addToQueue,
    startPlayback,
    getCurrentPlaybackState
}; 