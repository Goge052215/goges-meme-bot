require('dotenv').config({ path: './config.env' });
if (!process.env.SPOTIFY_CLIENT_ID) {
    require('dotenv').config({ path: '../config.env' });
}
const SpotifyWebApi = require('spotify-web-api-node');

let spotifyApiInstance = null;
const userTokens = new Map();
const tokenRefreshTimers = new Map();
const pendingAuths = new Map();

initializeModule();

async function initializeModule() {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        console.log('[SpotifyUtils] Spotify credentials not found - Spotify features disabled');
        return;
    }

    if (initializeSpotifyApi()) {
        const tokenSuccess = await getClientCredentialsToken();
        if (tokenSuccess) {
            console.log('[SpotifyUtils] Spotify API initialized successfully');
        } else {
            console.log('[SpotifyUtils] Spotify API initialized but token acquisition failed');
        }
    }
}

function initializeSpotifyApi() {
    try {
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI || 'https://gogesbot.hx13651954192.workers.dev/spotify/callback';
        
        spotifyApiInstance = new SpotifyWebApi({
            clientId: process.env.SPOTIFY_CLIENT_ID,
            clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
            redirectUri: redirectUri
        });

        return true;
    } catch (error) {
        console.error('[SpotifyUtils] Failed to initialize Spotify API:', error.message);
        return false;
    }
}

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
    
    pendingAuths.set(userId, {
        state: finalState,
        timestamp: Date.now(),
        expires: Date.now() + (10 * 60 * 1000)
    });
    
    setTimeout(() => {
        if (pendingAuths.has(userId)) {
            const auth = pendingAuths.get(userId);
            if (Date.now() > auth.expires) {
                pendingAuths.delete(userId);
            }
        }
    }, 10 * 60 * 1000);
    
    return { authUrl, state: finalState };
}

async function handleAuthCallback(code, state) {
    if (!spotifyApiInstance) {
        throw new Error('Spotify API not initialized');
    }
    
    try {
        const data = await spotifyApiInstance.authorizationCodeGrant(code);
        const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = data.body;
        
        const discordUserId = state ? state.split('_')[0] : null;
        if (!discordUserId) {
            throw new Error('Invalid state parameter - missing Discord user ID');
        }
        
        const pendingAuth = pendingAuths.get(discordUserId);
        if (!pendingAuth || pendingAuth.state !== state) {
            throw new Error('Invalid authentication - not requested or expired');
        }
        
        pendingAuths.delete(discordUserId);
        
        const tempApi = new SpotifyWebApi();
        tempApi.setAccessToken(accessToken);
        const userProfile = await tempApi.getMe();
        
        const tokenData = {
            accessToken,
            refreshToken,
            expiresAt: Date.now() + (expiresIn * 1000),
            spotifyUserId: userProfile.body.id,
            discordUserId: discordUserId,
            displayName: userProfile.body.display_name,
            email: userProfile.body.email,
            product: userProfile.body.product,
            country: userProfile.body.country,
            authorizedAt: Date.now()
        };
        
        userTokens.set(discordUserId, tokenData);
        scheduleTokenRefresh(discordUserId, expiresIn);
        
        console.log(`[SpotifyUtils] User authenticated: ${userProfile.body.display_name}`);
        return { 
            success: true, 
            userId: discordUserId, 
            spotifyUserId: userProfile.body.id,
            tokenData 
        };
        
    } catch (error) {
        console.error('[SpotifyUtils] OAuth callback failed:', error.message);
        return { success: false, error: error.message };
    }
}

async function processCallbackFromWorker(discordUserId, code, state) {
    try {
        console.log(`[SpotifyUtils] Processing OAuth callback for Discord user: ${discordUserId}`);
        
        const pendingAuth = pendingAuths.get(discordUserId);
        if (!pendingAuth) {
            throw new Error('No pending authentication found for this user');
        }
        
        if (pendingAuth.state !== state) {
            throw new Error('State mismatch - possible security issue');
        }
        
        if (Date.now() > pendingAuth.expires) {
            pendingAuths.delete(discordUserId);
            throw new Error('Authentication expired - please try again');
        }
        
        const result = await handleAuthCallback(code, state);
        
        if (result.success) {
            console.log(`[SpotifyUtils] OAuth completion successful for ${discordUserId}`);
            return {
                success: true,
                userInfo: {
                    discordUserId: result.userId,
                    spotifyUserId: result.spotifyUserId,
                    displayName: result.tokenData.displayName,
                    product: result.tokenData.product
                }
            };
        } else {
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.error(`[SpotifyUtils] OAuth processing failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

function hasPendingAuth(userId) {
    const pending = pendingAuths.get(userId);
    return pending && Date.now() < pending.expires;
}

function getAuthStatus(userId) {
    const userData = userTokens.get(userId);
    const pendingAuth = pendingAuths.get(userId);
    
    return {
        isAuthenticated: userData && Date.now() < userData.expiresAt,
        hasPendingAuth: pendingAuth && Date.now() < pendingAuth.expires,
        userData: userData ? {
            displayName: userData.displayName,
            spotifyUserId: userData.spotifyUserId,
            product: userData.product,
            authorizedAt: userData.authorizedAt,
            expiresAt: userData.expiresAt
        } : null
    };
}

function scheduleTokenRefresh(userId, expiresIn) {
    if (tokenRefreshTimers.has(userId)) {
        clearTimeout(tokenRefreshTimers.get(userId));
    }
    
    const refreshTime = (expiresIn - 300) * 1000; 
    const timer = setTimeout(() => refreshUserToken(userId), refreshTime);
    tokenRefreshTimers.set(userId, timer);
}

async function refreshUserToken(userId) {
    const userData = userTokens.get(userId);
    if (!userData?.refreshToken) {
        return false;
    }
    
    try {
        spotifyApiInstance.setRefreshToken(userData.refreshToken);
        const data = await spotifyApiInstance.refreshAccessToken();
        
        userData.accessToken = data.body.access_token;
        userData.refreshToken = data.body.refresh_token || userData.refreshToken;
        userData.expiresAt = Date.now() + (data.body.expires_in * 1000);
        
        userTokens.set(userId, userData);
        scheduleTokenRefresh(userId, data.body.expires_in);
        
        return true;
    } catch (error) {
        console.error(`[SpotifyUtils] Token refresh failed for user ${userId}:`, error.message);
        userTokens.delete(userId);
        return false;
    }
}

function getUserApi(userId) {
    const userData = userTokens.get(userId);
    if (!userData) return null;
    
    if (Date.now() >= userData.expiresAt) {
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
    
    pendingAuths.delete(userId);
    
    return userTokens.delete(userId);
}

async function getUserPlaylists(userId, options = {}) {
    const userApi = getUserApi(userId);
    if (!userApi) throw new Error('User not authenticated');
    
    const response = await userApi.getUserPlaylists({ limit: 50, ...options });
    return response.body.items;
}

async function getUserCurrentPlayback(userId) {
    const userApi = getUserApi(userId);
    if (!userApi) throw new Error('User not authenticated');
    
    try {
        const response = await userApi.getMyCurrentPlaybackState();
        return response.body;
    } catch (error) {
        if (error.statusCode === 204) return null;
        throw error;
    }
}

async function controlUserPlayback(userId, action, params = {}) {
    const userApi = getUserApi(userId);
    if (!userApi) throw new Error('User not authenticated');
    
    const actions = {
        play: () => params.uris 
            ? userApi.play({ uris: params.uris, device_id: params.deviceId })
            : userApi.play({ device_id: params.deviceId }),
        pause: () => userApi.pause({ device_id: params.deviceId }),
        next: () => userApi.skipToNext({ device_id: params.deviceId }),
        previous: () => userApi.skipToPrevious({ device_id: params.deviceId }),
        volume: () => userApi.setVolume(params.volume, { device_id: params.deviceId }),
        shuffle: () => userApi.setShuffle(params.state, { device_id: params.deviceId }),
        repeat: () => userApi.setRepeat(params.state, { device_id: params.deviceId })
    };
    
    const actionFn = actions[action];
    if (!actionFn) throw new Error(`Unknown playback action: ${action}`);
    
    await actionFn();
    return true;
}

async function addToUserQueue(userId, uri, deviceId = null) {
    const userApi = getUserApi(userId);
    if (!userApi) throw new Error('User not authenticated');
    
    await userApi.addToQueue(uri, { device_id: deviceId });
    return true;
}

async function getUserDevices(userId) {
    const userApi = getUserApi(userId);
    if (!userApi) throw new Error('User not authenticated');
    
    const response = await userApi.getMyDevices();
    return response.body.devices;
}

function setAccessToken(token) {
    if (spotifyApiInstance) {
        spotifyApiInstance.setAccessToken(token);
    }
}

async function searchTracks(query, options = {}) {
    const searchOptions = { limit: 20, ...options };
    const response = await spotifyApiInstance.searchTracks(query, searchOptions);
    return response;
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
        console.error(`[SpotifyUtils] Failed to get Spotify track info: ${error.message}`);
        return null;
    }
}

async function getClientCredentialsToken(retryCount = 0) {
    if (!spotifyApiInstance) return false;
    
    try {
        const response = await spotifyApiInstance.clientCredentialsGrant();
        
        if (response.body?.access_token) {
            spotifyApiInstance.setAccessToken(response.body.access_token);
            
            const expiresIn = response.body.expires_in || 3600;
            setTimeout(() => getClientCredentialsToken(), (expiresIn - 600) * 1000);
            
            return true;
        }
    } catch (error) {
        const isNetworkError = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'timeout', 'ECONNREFUSED', 'socket hang up']
            .some(err => error.message.includes(err));
        
        if (isNetworkError && retryCount < 3) {
            const delay = Math.min(5000 * Math.pow(2, retryCount), 30000);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await getClientCredentialsToken(retryCount + 1);
        }
        
        if (isNetworkError) {
            console.log('[SpotifyUtils] Spotify API connectivity issues - using fallback sources');
        } else {
            console.error(`[SpotifyUtils] Spotify token error: ${error.message}`);
        }
    }
    
    return false;
}

async function addToQueue() {
    throw new Error('User authentication required for queue operations');
}

async function startPlayback() {
    throw new Error('User authentication required for playback control');
}

async function getCurrentPlaybackState() {
    throw new Error('User authentication required for playback state');
}

module.exports = {
    // Core functions
    initializeSpotifyApi,
    setAccessToken,
    getClientCredentialsToken,
    spotifyApiInstance: () => spotifyApiInstance,
    
    // OAuth functions
    generateAuthUrl,
    handleAuthCallback,
    processCallbackFromWorker,
    refreshUserToken,
    getUserApi,
    isUserAuthenticated,
    revokeUserAuth,
    hasPendingAuth,
    getAuthStatus,
    
    // User-specific functions
    getUserPlaylists,
    getUserCurrentPlayback,
    controlUserPlayback,
    addToUserQueue,
    getUserDevices,
    
    // Search functions
    searchTracks,
    getSpotifyTrackId,
    isSpotifyUrl,
    getSpotifyTrackInfo,
    
    // Legacy compatibility (deprecated)
    addToQueue,
    startPlayback,
    getCurrentPlaybackState
}; 