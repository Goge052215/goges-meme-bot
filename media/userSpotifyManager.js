const { searchTracks } = require('./spotifyUtils');

// Simplified user Spotify manager without user authorization
// This provides fallback functionality for commands that might expect user-specific features

function createUserSpotifyApi(spotifyId) {
  console.log(`User-specific Spotify features disabled. Using public API for user: ${spotifyId}`);
  return null;
}

async function executeUserSpotifyCall(spotifyId, apiCall) {
  throw new Error('User authorization disabled. This bot uses public Spotify search only.');
}

async function getUserCurrentPlayback(spotifyId) {
  console.log('User playback control disabled. Bot plays music in Discord voice channels only.');
  return null;
}

async function getUserCurrentTrack(spotifyId) {
  console.log('User track access disabled. Bot plays music in Discord voice channels only.');
  return null;
}

async function startUserPlayback(spotifyId, trackUris, deviceId = null) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function addToUserQueue(spotifyId, trackUri, deviceId = null) {
  throw new Error('User queue control disabled. Use Discord music commands instead.');
}

async function pauseUserPlayback(spotifyId, deviceId = null) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function resumeUserPlayback(spotifyId, deviceId = null) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function skipUserToNext(spotifyId, deviceId = null) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function skipUserToPrevious(spotifyId, deviceId = null) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function getUserDevices(spotifyId) {
  console.log('User device access disabled. Bot plays music in Discord voice channels only.');
  return [];
}

async function transferUserPlayback(spotifyId, deviceId, play = true) {
  throw new Error('User playback control disabled. Use Discord music commands instead.');
}

async function searchUserTracks(spotifyId, query, options = {}) {
  // Use public search instead of user-specific search
  console.log(`Using public Spotify search for query: ${query}`);
  return await searchTracks(query, options);
}

module.exports = {
  createUserSpotifyApi,
  executeUserSpotifyCall,
  getUserCurrentPlayback,
  getUserCurrentTrack,
  startUserPlayback,
  addToUserQueue,
  pauseUserPlayback,
  resumeUserPlayback,
  skipUserToNext,
  skipUserToPrevious,
  getUserDevices,
  transferUserPlayback,
  searchUserTracks
}; 