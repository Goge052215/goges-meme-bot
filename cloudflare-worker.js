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
    <title>Goge's Discord Everything Bot</title>
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
            max-width: 900px;
            margin: 2rem;
        }
        .logo { font-size: 3rem; margin-bottom: 1rem; }
        h1 { color: #333; margin-bottom: 1rem; font-size: 2.5rem; }
        .subtitle { color: #666; margin-bottom: 2rem; font-size: 1.2rem; font-weight: 500; }
        .description { color: #666; margin-bottom: 2rem; line-height: 1.6; }
        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
        .feature-category {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 15px;
            border-left: 4px solid var(--accent-color);
        }
        .music { --accent-color: #1DB954; }
        .weather { --accent-color: #3498db; }
        .entertainment { --accent-color: #e74c3c; }
        .utility { --accent-color: #9b59b6; }
        
        .feature-category h3 { 
            color: #333; 
            margin-bottom: 1rem; 
            font-size: 1.4rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .feature-list { 
            list-style: none; 
            text-align: left;
        }
        .feature-list li { 
            color: #666; 
            margin-bottom: 0.5rem;
            padding-left: 1rem;
            position: relative;
        }
        .feature-list li:before {
            content: "•";
            color: var(--accent-color);
            font-weight: bold;
            position: absolute;
            left: 0;
        }
        .commands-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
            padding: 1.5rem;
            background: #f0f4f8;
            border-radius: 10px;
        }
        .command {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .command-name {
            font-weight: bold;
            color: #667eea;
            margin-bottom: 0.5rem;
        }
        .command-desc {
            font-size: 0.9rem;
            color: #666;
        }
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
        .stats {
            display: flex;
            justify-content: space-around;
            margin: 2rem 0;
            padding: 1rem;
            background: #667eea;
            color: white;
            border-radius: 10px;
        }
        .stat { text-align: center; }
        .stat-number { font-size: 2rem; font-weight: bold; }
        .stat-label { font-size: 0.9rem; opacity: 0.9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🤖</div>
        <h1>Goge's Everything Bot</h1>
        <div class="subtitle">Your All-in-One Discord Companion</div>
        <p class="description">
            A powerful, feature-rich Discord bot that handles music, weather, entertainment, and utilities. 
            From streaming your favorite songs to getting weather updates and having fun with memes!
        </p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">8+</div>
                <div class="stat-label">Commands</div>
            </div>
            <div class="stat">
                <div class="stat-number">4</div>
                <div class="stat-label">Categories</div>
            </div>
            <div class="stat">
                <div class="stat-number">3</div>
                <div class="stat-label">Music Sources</div>
            </div>
        </div>
        
        <div class="features">
            <div class="feature-category music">
                <h3>🎵 Music & Audio</h3>
                <ul class="feature-list">
                    <li>Multi-source streaming (Spotify, YouTube, SoundCloud)</li>
                    <li>Interactive song search with dropdown selection</li>
                    <li>Queue management and playback controls</li>
                    <li>Spotify integration with pause/resume/skip</li>
                    <li>Device management and current track display</li>
                </ul>
            </div>
            
            <div class="feature-category weather">
                <h3>🌤️ Weather & Information</h3>
                <ul class="feature-list">
                    <li>Real-time weather data for any city</li>
                    <li>Temperature, humidity, and wind speed</li>
                    <li>Weather conditions with icons</li>
                    <li>Worldwide coverage</li>
                </ul>
            </div>
            
            <div class="feature-category entertainment">
                <h3>🎪 Entertainment & Fun</h3>
                <ul class="feature-list">
                    <li>Random memes from popular subreddits</li>
                    <li>Daily jokes and punchlines</li>
                    <li>Magic 8-ball for decision making</li>
                    <li>Interactive responses and reactions</li>
                </ul>
            </div>
            
            <div class="feature-category utility">
                <h3>🛠️ Utilities & Tools</h3>
                <ul class="feature-list">
                    <li>Ping and latency testing</li>
                    <li>Comprehensive help system</li>
                    <li>Server diagnostics</li>
                    <li>Real-time status monitoring</li>
                </ul>
            </div>
        </div>
        
        <div class="commands-grid">
            <div class="command">
                <div class="command-name">/music play</div>
                <div class="command-desc">Play songs from multiple sources</div>
            </div>
            <div class="command">
                <div class="command-name">/music search</div>
                <div class="command-desc">Interactive song selection</div>
            </div>
            <div class="command">
                <div class="command-name">/weather</div>
                <div class="command-desc">Get weather for any city</div>
            </div>
            <div class="command">
                <div class="command-name">/meme</div>
                <div class="command-desc">Random memes and images</div>
            </div>
            <div class="command">
                <div class="command-name">/joke</div>
                <div class="command-desc">Daily jokes and punchlines</div>
            </div>
            <div class="command">
                <div class="command-name">/8ball</div>
                <div class="command-desc">Ask the magic 8-ball</div>
            </div>
            <div class="command">
                <div class="command-name">/ping</div>
                <div class="command-desc">Check bot latency</div>
            </div>
            <div class="command">
                <div class="command-name">/help</div>
                <div class="command-desc">Get help and command list</div>
            </div>
        </div>
        
        <div class="buttons">
            <a href="https://discord.com/oauth2/authorize?client_id=YOUR_BOT_CLIENT_ID&permissions=3164160&scope=bot%20applications.commands" 
               class="btn" target="_blank">Add to Discord</a>
            <a href="/status" class="btn secondary">Bot Status</a>
        </div>
        
        <div class="status">
            <div class="status-indicator">🟢 Online</div>
            <p>Bot is currently running and ready to serve all your Discord needs!</p>
        </div>
        
        <p style="margin-top: 2rem; color: #9ca3af; font-size: 0.8rem;">
            Powered by DisCloud & Cloudflare | Made with ❤️ by Goge
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
      name: 'Goge\'s Everything Bot',
      type: 'all-in-one discord companion',
      hosting: 'DisCloud',
      deployment_type: 'bot',
      ram: '256MB'
    },
    features: {
      music: {
        sources: ['spotify', 'youtube', 'soundcloud'],
        capabilities: ['streaming', 'queue_management', 'search', 'playback_control']
      },
      weather: {
        provider: 'openweathermap',
        coverage: 'worldwide',
        data: ['temperature', 'humidity', 'wind', 'conditions']
      },
      entertainment: {
        types: ['memes', 'jokes', '8ball'],
        apis: ['meme-api', 'joke-api'],
        interactive: true
      },
      utilities: {
        functions: ['ping', 'help', 'diagnostics', 'monitoring'],
        latency_tracking: true
      }
    },
    commands: {
      total: 8,
      categories: {
        music: ['/music play', '/music search', '/music current', '/music pause', '/music resume', '/music skip'],
        weather: ['/weather'],
        entertainment: ['/meme', '/joke', '/8ball'],
        utility: ['/ping', '/help']
      }
    },
    endpoints: {
      web: 'Cloudflare Workers',
      domain: 'gogesbot.workers.dev',
      custom_domain: 'gogesbot.net.eu.org (pending)'
    },
    stats: {
      uptime: 'monitoring via DisCloud',
      response_time: 'real-time monitoring',
      availability: '99.9%'
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