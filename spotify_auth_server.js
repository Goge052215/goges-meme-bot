require('dotenv').config({ path: './config.env' });
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.error('❌ Missing Spotify credentials in config.env');
    process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://localhost:${PORT}/callback`
});

const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state', 
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
];

let userTokens = new Map();

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head><title>Spotify Bot Authorization</title></head>
            <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                <h1>🎵 Spotify Bot Authorization</h1>
                <p>To use Spotify playback control commands, you need to authorize this bot.</p>
                <h3>Requirements:</h3>
                <ul>
                    <li>Spotify Premium account</li>
                    <li>Active Spotify session (app open on a device)</li>
                </ul>
                <a href="/auth" style="background: #1DB954; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold;">
                    🔗 Authorize Spotify Bot
                </a>
                <hr style="margin: 30px 0;">
                <h3>Supported Commands:</h3>
                <ul>
                    <li><code>/music play [song]</code> - Play on Spotify</li>
                    <li><code>/music pause</code> - Pause Spotify</li>
                    <li><code>/music skip</code> - Skip track</li>
                    <li><code>/music current</code> - Show current track</li>
                    <li><code>/music devices</code> - Show Spotify devices</li>
                </ul>
            </body>
        </html>
    `);
});

app.get('/auth', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const authURL = spotifyApi.createAuthorizeURL(scopes, state);
    res.redirect(authURL);
});

app.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
        return res.send(`
            <html>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h1>❌ Authorization Failed</h1>
                    <p>Error: ${error}</p>
                    <a href="/auth">Try Again</a>
                </body>
            </html>
        `);
    }
    
    if (!code) {
        return res.send(`
            <html>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h1>❌ No Authorization Code</h1>
                    <p>Please try the authorization process again.</p>
                    <a href="/auth">Try Again</a>
                </body>
            </html>
        `);
    }
    
    try {
        const tokenResponse = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = tokenResponse.body;
        
        spotifyApi.setAccessToken(access_token);
        spotifyApi.setRefreshToken(refresh_token);
        
        const userProfile = await spotifyApi.getMe();
        const userId = userProfile.body.id;
        
        userTokens.set(userId, {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000),
            spotifyId: userId,
            displayName: userProfile.body.display_name
        });
        
        console.log(`✅ User authorized: ${userProfile.body.display_name} (${userId})`);
        console.log(`🔑 Token expires: ${new Date(Date.now() + (expires_in * 1000)).toLocaleString()}`);
        
        res.send(`
            <html>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h1>✅ Spotify Authorization Successful!</h1>
                    <p><strong>Welcome, ${userProfile.body.display_name}!</strong></p>
                    <p>Your Discord bot can now control your Spotify playback.</p>
                    <h3>✨ You can now use:</h3>
                    <ul>
                        <li><code>/music play [song]</code> - Play songs on your Spotify</li>
                        <li><code>/music pause</code> - Pause your Spotify</li>
                        <li><code>/music resume</code> - Resume playback</li>
                        <li><code>/music skip</code> - Skip to next track</li>
                        <li><code>/music current</code> - Show current track</li>
                        <li><code>/music devices</code> - Show your Spotify devices</li>
                    </ul>
                    <p><em>Make sure you have Spotify open on a device!</em></p>
                    <hr>
                    <p>🔒 Your authorization will expire in ${Math.floor(expires_in / 3600)} hours.</p>
                    <p>You can close this window and return to Discord.</p>
                </body>
            </html>
        `);
        
    } catch (tokenError) {
        console.error('Token exchange failed:', tokenError);
        res.send(`
            <html>
                <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
                    <h1>❌ Token Exchange Failed</h1>
                    <p>Error: ${tokenError.message}</p>
                    <a href="/auth">Try Again</a>
                </body>
            </html>
        `);
    }
});

app.get('/status', (req, res) => {
    const authorizedUsers = Array.from(userTokens.values()).map(user => ({
        displayName: user.displayName,
        spotifyId: user.spotifyId,
        expiresAt: new Date(user.expiresAt).toLocaleString(),
        isExpired: Date.now() > user.expiresAt
    }));
    
    res.json({
        totalAuthorizedUsers: userTokens.size,
        users: authorizedUsers
    });
});

function getUserToken(spotifyId) {
    return userTokens.get(spotifyId);
}

function getAllUserTokens() {
    return userTokens;
}

app.listen(PORT, () => {
    console.log(`🌐 Spotify Authorization Server running on http://localhost:${PORT}`);
    console.log(`🔗 Send users to: http://localhost:${PORT} to authorize the bot`);
    console.log(`📊 Status endpoint: http://localhost:${PORT}/status`);
});

module.exports = {
    getUserToken,
    getAllUserTokens,
    userTokens
}; 