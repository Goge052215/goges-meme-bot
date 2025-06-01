require('dotenv').config({ path: './config.env' });
if (!process.env.SPOTIFY_CLIENT_ID) {
require('dotenv').config({ path: '../config.env' });
}
const SpotifyWebApi = require('spotify-web-api-node');

let spotifyApiInstance = null;

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
        spotifyApiInstance = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
        });

        console.log('Spotify API initialized successfully');
    return true;
  } catch (error) {
        console.error('Failed to initialize Spotify API:', error.message);
    return false;
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

module.exports = {
    initializeSpotifyApi,
    setAccessToken,
    getClientCredentialsToken,
    spotifyApiInstance: () => spotifyApiInstance,
    
    searchTracks,
    getSpotifyTrackId,
    isSpotifyUrl,
    getSpotifyTrackInfo
}; 