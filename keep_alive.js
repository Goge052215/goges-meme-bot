const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const { spotifyApiInstance, setAccessToken } = require('./media/spotifyUtils');
const { performanceMonitor } = require('./media/performanceMonitor');
const server = express();

let userTokens = new Map();
let spotifyApi = null;

setInterval(() => {
  cleanupExpiredTokens();
}, 60 * 60 * 1000);

function cleanupExpiredTokens() {
  const now = Date.now();
  let cleanupCount = 0;
  
  for (const [userId, tokenData] of userTokens.entries()) {
    if (now > tokenData.expiresAt) {
      userTokens.delete(userId);
      cleanupCount++;
    }
  }
  
  if (cleanupCount > 0) {
    console.log(`🧹 Cleaned up ${cleanupCount} expired Spotify tokens`);
  }
}

function scheduleTokenRefresh(userId, delaySeconds) {
  if (delaySeconds <= 0) return;
  
  setTimeout(async () => {
    await refreshUserToken(userId);
  }, delaySeconds * 1000);
}

async function refreshUserToken(userId) {
  const userData = userTokens.get(userId);
  if (!userData || !userData.refreshToken) {
    console.log(`⚠️ No refresh token found for user: ${userId}`);
    return false;
  }

  try {
    const refreshApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI,
      refreshToken: userData.refreshToken
    });

    console.log(`🔄 Refreshing token for user: ${userData.displayName}`);
    const tokenResponse = await refreshApi.refreshAccessToken();
    const { access_token, expires_in } = tokenResponse.body;

    userData.accessToken = access_token;
    userData.expiresAt = Date.now() + (expires_in * 1000);
    userData.lastRefresh = Date.now();
    
    userTokens.set(userId, userData);
    
    console.log(`✅ Token refreshed for ${userData.displayName}`);
    console.log(`🔑 New expiry: ${new Date(userData.expiresAt).toLocaleString()}`);
    
    scheduleTokenRefresh(userId, expires_in - 300);
    
    return true;
  } catch (error) {
    console.error(`❌ Token refresh failed for ${userData.displayName}: ${error.message}`);
    
    userTokens.delete(userId);
    return false;
  }
}

function initializeSpotifyAuth() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('⚠️ Spotify credentials not found - authorization disabled');
    return false;
  }

  const isDevelopment = !process.env.DISCLOUD && !process.env.RAILWAY_PUBLIC_DOMAIN;
  const baseUrl = process.env.APP_URL || 
    (isDevelopment 
      ? 'http://localhost:8080'
      : 'https://gogesbot.discloud.app');

  console.log(`🔍 Environment detection: ${isDevelopment ? 'Development' : 'Production'}`);
  console.log(`🌐 Authorization URL: ${baseUrl}`);

  spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI || `${baseUrl}/callback`
  });

  console.log('🔗 Spotify authorization server initialized');
  console.log(`📍 Redirect URI: ${process.env.SPOTIFY_REDIRECT_URI || `${baseUrl}/callback`}`);

  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state', 
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-read-collaborative'
  ];

  // Spotify authorization routes
  server.get('/auth', (req, res) => {
    const state = Math.random().toString(36).substring(2, 15);
    const authURL = spotifyApi.createAuthorizeURL(scopes, state);
    res.redirect(authURL);
  });

  // POST endpoint for OAuth callbacks forwarded from Cloudflare Worker
  server.post('/spotify/callback', express.json(), async (req, res) => {
    try {
      const { code, state, userId } = req.body;
      
      if (!code || !state || !userId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: code, state, or userId'
        });
      }

      console.log(`📞 Received OAuth callback for Discord user: ${userId}`);
      
      const { processCallbackFromWorker } = require('./media/spotifyUtils');
      const result = await processCallbackFromWorker(userId, code, state);
      
      if (result.success) {
        console.log(`✅ OAuth successful for Discord user ${userId}`);
        
        res.json({
          success: true,
          message: 'Spotify account connected successfully',
          userInfo: result.userInfo
        });
      } else {
        console.log(`❌ OAuth failed for Discord user ${userId}: ${result.error}`);
        
        res.status(400).json({
          success: false,
          error: result.error || 'Authentication failed'
        });
      }
    } catch (error) {
      console.error('❌ OAuth callback processing error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error during authentication'
      });
    }
  });

  // Health check endpoint
  server.get('/health', (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      spotify: {
        initialized: !!spotifyApi,
        activeTokens: userTokens.size
      }
    });
  });

  server.get('/spotify/status/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      const { getAuthStatus } = require('./media/spotifyUtils');
      const status = getAuthStatus(userId);
      
      res.json({
        success: true,
        status: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  server.get('/callback', async (req, res) => {
    const { code, error } = req.query;
    
    if (error) {
      return res.send(`
        <html>
          <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>❌ Authorization Failed</h1>
            <p>Error: ${error}</p>
            <a href="/auth" style="background: #1DB954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a>
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
            <a href="/auth" style="background: #1DB954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a>
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
      const expiresAt = Date.now() + (expires_in * 1000);
      
      const userData = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: expiresAt,
        spotifyId: userId,
        displayName: userProfile.body.display_name,
        email: userProfile.body.email,
        country: userProfile.body.country,
        product: userProfile.body.product,
        authorizedAt: Date.now(),
        lastRefresh: Date.now()
      };
      
      userTokens.set(userId, userData);
      
      console.log(`✅ Spotify user authorized: ${userProfile.body.display_name} (${userId})`);
      console.log(`🎵 Account type: ${userProfile.body.product}`);
      console.log(`🔑 Token expires: ${new Date(expiresAt).toLocaleString()}`);
      
      scheduleTokenRefresh(userId, expires_in - 300);
      
      res.send(`
        <html>
          <head>
            <title>✅ Spotify Authorization Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial; margin: 0; background: linear-gradient(135deg, #1DB954, #1ed760); }
              .container { max-width: 700px; margin: 50px auto; padding: 30px; }
              .card { background: white; border-radius: 20px; padding: 40px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
              .success-icon { font-size: 3em; text-align: center; margin-bottom: 20px; }
              .user-info { background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
              .commands { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin: 20px 0; }
              .command { background: #f8f9fa; padding: 15px; border-radius: 10px; border-left: 4px solid #1DB954; }
              .command code { background: #e9ecef; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
              .footer { text-align: center; margin-top: 30px; color: #666; }
              .premium-badge { background: #1DB954; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="card">
                <div class="success-icon">🎉</div>
                <h1 style="color: #1DB954; text-align: center; margin-bottom: 10px;">Authorization Successful!</h1>
                
                <div class="user-info">
                  <h3 style="margin-top: 0;">👋 Welcome, ${userProfile.body.display_name}!</h3>
                  <p><strong>Account Type:</strong> ${userProfile.body.product} ${userProfile.body.product === 'premium' ? '<span class="premium-badge">PREMIUM</span>' : ''}</p>
                  <p><strong>Country:</strong> ${userProfile.body.country}</p>
                  <p><strong>Token Expires:</strong> ${new Date(expiresAt).toLocaleString()}</p>
                  <p><strong>Auto-refresh:</strong> ✅ Enabled (tokens will refresh automatically)</p>
                </div>

                <h3>🎵 Available Discord Commands:</h3>
                <div class="commands">
                  <div class="command">
                    <code>/music play [song]</code><br>
                    <small>Play songs on your Spotify</small>
                  </div>
                  <div class="command">
                    <code>/music pause</code><br>
                    <small>Pause current playback</small>
                  </div>
                  <div class="command">
                    <code>/music resume</code><br>
                    <small>Resume playback</small>
                  </div>
                  <div class="command">
                    <code>/music skip</code><br>
                    <small>Skip to next track</small>
                  </div>
                  <div class="command">
                    <code>/music current</code><br>
                    <small>Show current track</small>
                  </div>
                  <div class="command">
                    <code>/music devices</code><br>
                    <small>Show Spotify devices</small>
                  </div>
                </div>

                ${userProfile.body.product !== 'premium' ? `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 10px; margin: 20px 0;">
                  <strong>⚠️ Note:</strong> Some playback control features require a Spotify Premium subscription.
                  Free accounts can still use search and queue features.
                </div>
                ` : ''}

                <div class="footer">
                  <p>💡 <strong>Tip:</strong> Make sure you have Spotify open on a device!</p>
                  <p>🔒 Your data is secure and only used for bot functionality</p>
                  <p style="color: #1DB954; font-weight: bold; font-size: 1.1em;">You can now close this window and return to Discord!</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
      
    } catch (tokenError) {
      console.error('Spotify token exchange failed:', tokenError);
      res.send(`
        <html>
          <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
            <h1>❌ Token Exchange Failed</h1>
            <p>Error: ${tokenError.message}</p>
            <a href="/auth" style="background: #1DB954; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Try Again</a>
          </body>
        </html>
      `);
    }
  });

  server.get('/status', (req, res) => {
    const now = Date.now();
    const authorizedUsers = Array.from(userTokens.values()).map(user => ({
      displayName: user.displayName,
      spotifyId: user.spotifyId,
      product: user.product,
      country: user.country,
      authorizedAt: new Date(user.authorizedAt).toLocaleString(),
      expiresAt: new Date(user.expiresAt).toLocaleString(),
      lastRefresh: new Date(user.lastRefresh).toLocaleString(),
      isExpired: now > user.expiresAt,
      timeUntilExpiry: Math.max(0, Math.floor((user.expiresAt - now) / 1000 / 60))
    }));
    
    const activeUsers = authorizedUsers.filter(user => !user.isExpired);
    const expiredUsers = authorizedUsers.filter(user => user.isExpired);
    
    res.json({
      botStatus: 'online',
      spotify: {
      totalAuthorizedUsers: userTokens.size,
        activeUsers: activeUsers.length,
        expiredUsers: expiredUsers.length,
        premiumUsers: authorizedUsers.filter(user => user.product === 'premium').length,
        freeUsers: authorizedUsers.filter(user => user.product === 'free').length
      },
      users: authorizedUsers,
      serverInfo: {
        authUrl: baseUrl,
        uptime: Math.floor(process.uptime()),
        uptimeFormatted: formatUptime(process.uptime()),
        environment: isDevelopment ? 'development' : 'production',
        port: process.env.PORT || 8080,
        nodeVersion: process.version
      }
    });
  });

  server.get('/performance', (req, res) => {
    const stats = performanceMonitor.getStats();
    res.json({
      performance: stats,
      timestamp: new Date().toISOString(),
      message: 'Bot performance metrics'
    });
  });

  server.get('/api/users', (req, res) => {
    const users = Array.from(userTokens.values()).map(user => ({
      spotifyId: user.spotifyId,
      displayName: user.displayName,
      product: user.product,
      isExpired: Date.now() > user.expiresAt
    }));
    
    res.json({ users });
  });

  server.post('/api/users/:userId/refresh', async (req, res) => {
    const { userId } = req.params;
    const success = await refreshUserToken(userId);
    
    if (success) {
      res.json({ success: true, message: 'Token refreshed successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Token refresh failed' });
    }
  });

  server.delete('/api/users/:userId', (req, res) => {
    const { userId } = req.params;
    const userData = userTokens.get(userId);
    
    if (userData) {
      userTokens.delete(userId);
      console.log(`🗑️ Removed authorization for user: ${userData.displayName}`);
      res.json({ success: true, message: 'User authorization removed' });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  });

  return true;
}

server.all('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  if (!spotifyApi) {
    res.send(`
      <html>
        <head><title>🤖 Meme Bot Status</title></head>
        <body style="font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>🤖 Meme Bot is Online!</h1>
          <p>The Discord bot is running, but Spotify integration is not configured.</p>
          <hr>
          <p><strong>Status:</strong> Bot Online</p>
          <p><strong>Uptime:</strong> ${Math.floor(process.uptime())} seconds</p>
        </body>
      </html>
    `);
    return;
  }

  res.send(`
    <html>
      <head><title>🎵 Discord Music Bot - Spotify Authorization</title></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial; max-width: 700px; margin: 50px auto; padding: 30px; background: #f8f9fa;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #1DB954; font-size: 2.5em; margin-bottom: 10px;">🎵 Discord Music Bot</h1>
          <h2 style="color: #333; font-weight: 300;">Spotify Authorization</h2>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 30px;">
          <p style="font-size: 1.1em; line-height: 1.6; margin-bottom: 20px;">
            To use Spotify playback control commands in Discord, you need to authorize this bot to access your Spotify account.
          </p>
          
          <h3 style="color: #1DB954;">📋 Requirements:</h3>
          <ul style="line-height: 1.8;">
            <li><strong>Spotify Premium account</strong> (required for playback control)</li>
            <li><strong>Active Spotify session</strong> (app open on any device)</li>
            <li><strong>One-time authorization</strong> (takes 30 seconds)</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="/auth" style="background: linear-gradient(135deg, #1DB954, #1ed760); color: white; padding: 18px 40px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 1.1em; display: inline-block; transition: transform 0.2s; box-shadow: 0 4px 15px rgba(29, 185, 84, 0.3);">
              🔗 Authorize Spotify Access
            </a>
          </div>
        </div>

        <div style="background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <h3 style="color: #333; margin-bottom: 15px;">✨ Available Commands After Authorization:</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-family: monospace;">
            <div><code>/music play [song]</code><br><small>Play on your Spotify</small></div>
            <div><code>/music pause</code><br><small>Pause playback</small></div>
            <div><code>/music resume</code><br><small>Resume playback</small></div>
            <div><code>/music skip</code><br><small>Skip to next track</small></div>
            <div><code>/music current</code><br><small>Show current track</small></div>
            <div><code>/music devices</code><br><small>Show Spotify devices</small></div>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #666; font-size: 0.9em;">
          <p>🔒 Your data is secure and only used for bot functionality</p>
          <p><a href="/status">View Server Status</a></p>
        </div>
      </body>
    </html>
  `);
});

function keepAlive() {
  // DisCloud requires port 8080 for external access
  const PORT = process.env.PORT || 8080;
  
  // Initialize Spotify authorization if credentials are available
  const spotifyEnabled = initializeSpotifyAuth();
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server is ready! Listening on port ${PORT}`);
    console.log(`🔧 DisCloud Configuration: Using port ${PORT} for external access`);
    if (spotifyEnabled) {
      console.log(`🎵 Spotify Authorization Server integrated on port ${PORT}`);
      console.log(`🔗 Users can authorize at: ${process.env.APP_URL || `https://gogesbot.discloud.app`}`);
      console.log(`📊 Server status: ${process.env.APP_URL || `https://gogesbot.discloud.app`}/status`);
    } else {
      console.log(`📱 Bot status page available at: ${process.env.APP_URL || `https://gogesbot.discloud.app`}`);
    }
  });
}

function formatUptime(uptimeSeconds) {
  const days = Math.floor(uptimeSeconds / 86400);
  const hours = Math.floor((uptimeSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

function getUserToken(spotifyId) {
  const userData = userTokens.get(spotifyId);
  
  if (userData && Date.now() > userData.expiresAt) {
    console.log(`⚠️ Token expired for user: ${userData.displayName}`);
    refreshUserToken(spotifyId).catch(error => {
      console.error(`Failed to auto-refresh token for ${userData.displayName}:`, error.message);
    });
    return null;
  }
  
  return userData;
}

function getAllUserTokens() {
  return userTokens;
}

function getActiveUserTokens() {
  const now = Date.now();
  const activeTokens = new Map();
  
  for (const [userId, userData] of userTokens.entries()) {
    if (now <= userData.expiresAt) {
      activeTokens.set(userId, userData);
    }
  }
  
  return activeTokens;
}

function isUserAuthorized(spotifyId) {
  const userData = getUserToken(spotifyId);
  return userData !== null;
}

module.exports = { 
  keepAlive, 
  getUserToken, 
  getAllUserTokens,
  getActiveUserTokens,
  isUserAuthorized,
  refreshUserToken,
  cleanupExpiredTokens
}; 