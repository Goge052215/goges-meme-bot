/**
 * Cloudflare Worker for Goge's Discord Bot
 * Handles OAuth callbacks and provides web interface
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      switch (path) {
        case '/':
          return handleHomePage();
        case '/callback':
          return handleSpotifyCallback(url);
        case '/auth':
          return handleSpotifyAuth();
        case '/status':
          return handleStatus();
        case '/bot':
          return handleBotRedirect();
        default:
          return handle404();
      }
    } catch (error) {
      return handleError(error);
    }
  }
};

// Home page with bot information
function handleHomePage() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Goge's Discord Music Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 600px;
            margin: 2rem;
        }
        .logo { font-size: 3rem; margin-bottom: 1rem; }
        h1 { color: #333; margin-bottom: 1rem; }
        .description { color: #666; margin-bottom: 2rem; line-height: 1.6; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .feature {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        .feature h3 { color: #333; margin-bottom: 0.5rem; }
        .feature p { color: #666; font-size: 0.9rem; }
        .buttons { margin-top: 2rem; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #5a67d8; }
        .btn.secondary { background: #e2e8f0; color: #4a5568; }
        .btn.secondary:hover { background: #cbd5e0; }
        .status { margin-top: 2rem; padding: 1rem; background: #f0fff4; border-radius: 8px; }
        .status-indicator { color: #48bb78; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵</div>
        <h1>Goge's Discord Music Bot</h1>
        <p class="description">
            A powerful Discord music bot with multi-source streaming, supporting Spotify, 
            YouTube, and SoundCloud. Enjoy high-quality music with your friends!
        </p>
        
        <div class="features">
            <div class="feature">
                <h3>🎧 Multi-Source</h3>
                <p>Play from Spotify, YouTube, and SoundCloud</p>
            </div>
            <div class="feature">
                <h3>🔍 Smart Search</h3>
                <p>Interactive song selection with multiple results</p>
            </div>
            <div class="feature">
                <h3>⚡ Fast & Reliable</h3>
                <p>Optimized hosting with automatic fallbacks</p>
            </div>
            <div class="feature">
                <h3>🛠️ Easy to Use</h3>
                <p>Simple slash commands for all music needs</p>
            </div>
        </div>
        
        <div class="buttons">
            <a href="https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=3164160&scope=bot%20applications.commands" 
               class="btn" target="_blank">Add to Discord</a>
            <a href="/status" class="btn secondary">Bot Status</a>
        </div>
        
        <div class="status">
            <div class="status-indicator">🟢 Online</div>
            <p>Bot is currently running and ready to serve music!</p>
        </div>
        
        <p style="margin-top: 2rem; color: #9ca3af; font-size: 0.8rem;">
            Powered by DisCloud & Cloudflare | Made by Goge
        </p>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Handle Spotify OAuth callback
function handleSpotifyCallback(url) {
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Authorization Failed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .error { color: #e53e3e; background: #fed7d7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <h1>❌ Authorization Failed</h1>
    <div class="error">
        <p>Error: ${error}</p>
        <p>Please try the authorization process again.</p>
    </div>
    <a href="/auth" class="btn">Try Again</a>
    <a href="/" class="btn" style="background: #718096;">Back to Home</a>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  if (code) {
    // In a real implementation, you'd exchange the code for tokens here
    // For now, we'll show a success page
    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Authorization Successful</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .success { color: #38a169; background: #c6f6d5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
    </style>
</head>
<body>
    <h1>✅ Authorization Successful!</h1>
    <div class="success">
        <p>Your Spotify account has been successfully connected.</p>
        <p>You can now use enhanced music features in Discord!</p>
    </div>
    <a href="/" class="btn">Back to Home</a>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  return new Response('Invalid callback request', { status: 400 });
}

// Handle Spotify authorization request
function handleSpotifyAuth() {
  // This would redirect to Spotify's OAuth endpoint
  // For now, return a placeholder
  return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Spotify Authorization</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .info { background: #bee3f8; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .btn { display: inline-block; padding: 10px 20px; background: #1DB954; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
    </style>
</head>
<body>
    <h1>🎵 Spotify Authorization</h1>
    <div class="info">
        <p>This bot currently uses public Spotify data (search and track info).</p>
        <p>User authorization features are planned for future updates!</p>
    </div>
    <a href="/" class="btn" style="background: #667eea;">Back to Home</a>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Handle status endpoint
function handleStatus() {
  const status = {
    status: 'online',
    timestamp: new Date().toISOString(),
    bot: {
      hosting: 'DisCloud',
      type: 'bot',
      ram: '256MB'
    },
    features: {
      spotify: 'client_credentials',
      youtube: 'enabled',
      soundcloud: 'enabled'
    },
    endpoints: {
      web: 'Cloudflare Workers',
      domain: 'gogesbot.workers.dev'
    }
  };

  return new Response(JSON.stringify(status, null, 2), {
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    }
  });
}

// Redirect to bot invite
function handleBotRedirect() {
  const inviteUrl = 'https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=3164160&scope=bot%20applications.commands';
  return Response.redirect(inviteUrl, 302);
}

// Handle 404 errors
function handle404() {
  return new Response(`
<!DOCTYPE html>
<html>
<head>
    <title>Page Not Found</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        .error { color: #e53e3e; font-size: 4rem; margin-bottom: 1rem; }
        .btn { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px; }
    </style>
</head>
<body>
    <div class="error">404</div>
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/" class="btn">Go Home</a>
</body>
</html>`, { 
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Handle errors
function handleError(error) {
  console.error('Worker error:', error);
  return new Response('Internal Server Error', { status: 500 });
} 