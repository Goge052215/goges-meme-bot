require('dotenv').config({ path: './config.env' });
const SpotifyWebApi = require('spotify-web-api-node');

console.log('🎵 Spotify Bot Authorization Setup');
console.log('=====================================\n');

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials in config.env');
    console.log('Make sure SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are set');
    process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback'
});

const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state', 
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
];

const state = Math.random().toString(36).substring(2, 15);
const authURL = spotifyApi.createAuthorizeURL(scopes, state);

console.log('🔗 AUTHORIZATION URL:');
console.log('=====================================');
console.log(authURL);
console.log('=====================================\n');

console.log('📋 INSTRUCTIONS:');
console.log('1. Copy the URL above');
console.log('2. Open it in your browser');
console.log('3. Log in to Spotify');
console.log('4. Click "Agree" to authorize the bot');
console.log('5. You\'ll be redirected to: http://localhost:3000/callback?code=...');
console.log('6. Copy the "code" parameter from the URL');
console.log('7. Use that code to get your access token\n');

console.log('⚠️  REQUIREMENTS:');
console.log('- You need Spotify Premium to control playback');
console.log('- You need an active Spotify session (app open on a device)');
console.log('- This authorization is per-user (each Discord user needs to do this)\n');

console.log('🎯 NEXT STEPS:');
console.log('Once you have the authorization code, you can exchange it for tokens');
console.log('or set up a web server to handle the OAuth flow automatically.'); 