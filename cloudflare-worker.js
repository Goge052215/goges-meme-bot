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
        case '/spotify/callback':
          return handleSpotifyCallback(url);
        case '/oauth/spotify':
          return handleSpotifyOAuthDirect(url);
        case '/spotify/auth':
          return handleSpotifyAuthRedirect(url);
        case '/spotify/status':
          return handleSpotifyStatus(url);
        case '/spotify/guide':
          return handleSpotifyGuide();
        case '/spotify/help':
          return handleSpotifyHelp();
        case '/discord':
          return handleDiscordGuide();
        case '/callback':
          return handleSpotifyCallback(url);
        case '/auth':
          return handleSpotifyAuth();
        case '/status':
          return handleStatus();
        case '/bot':
          return handleBotRedirect();
        case '/guide':
          return handleGeneralGuide();
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
        .btn.spotify { background: #1DB954; }
        .btn.spotify:hover { background: #1ed760; }
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
        .spotify-info {
            margin: 2rem 0;
            padding: 1.5rem;
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            color: white;
            border-radius: 15px;
        }
        .spotify-info h3 { margin-bottom: 1rem; }
        .spotify-info p { margin-bottom: 1rem; line-height: 1.5; }
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
        
        <div class="spotify-info">
            <h3>🎵 Enhanced Spotify Integration</h3>
            <p>Now with OAuth support! Connect your Spotify account to unlock premium features:</p>
            <ul style="text-align: left; margin-left: 2rem;">
                <li>Control your Spotify playback directly from Discord</li>
                <li>Access your personal playlists and saved music</li>
                <li>Add songs to your Spotify queue</li>
                <li>Pause, skip, and control volume on any device</li>
            </ul>
            <p style="margin-top: 1rem; font-size: 0.9rem; opacity: 0.9;">
                <strong>🔗 To Get Started:</strong> Use <code>/spotify login</code> in Discord to connect your account!
            </p>
            <div style="margin-top: 1rem;">
                <a href="/spotify/guide" style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; margin-right: 10px;">📖 Setup Guide</a>
                <a href="/discord" style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none;">💬 Discord Commands</a>
            </div>
        </div>
        
        <div class="features">
            <div class="feature-category music">
                <h3>🎵 Music & Audio</h3>
                <ul class="feature-list">
                    <li>Multi-source streaming (Spotify, YouTube, SoundCloud)</li>
                    <li>Queue management with smart prebuffering</li>
                    <li>Personal Spotify account integration</li>
                    <li>Playback controls and device management</li>
                    <li>Intelligent fallback and error recovery</li>
                </ul>
            </div>
            <div class="feature-category weather">
                <h3>🌤️ Weather Information</h3>
                <ul class="feature-list">
                    <li>Current weather conditions</li>
                    <li>Temperature and "feels like" data</li>
                    <li>Humidity and wind information</li>
                    <li>Support for any city worldwide</li>
                </ul>
            </div>
            <div class="feature-category entertainment">
                <h3>🎮 Entertainment</h3>
                <ul class="feature-list">
                    <li>Random memes from popular subreddits</li>
                    <li>Dad jokes and humor</li>
                    <li>Magic 8-ball predictions</li>
                    <li>Fun interactive responses</li>
                </ul>
            </div>
            <div class="feature-category utility">
                <h3>🛠️ Utilities</h3>
                <ul class="feature-list">
                    <li>Bot status and latency check</li>
                    <li>Comprehensive help system</li>
                    <li>User-friendly error handling</li>
                    <li>Slash command interface</li>
                </ul>
            </div>
        </div>
        
        <div class="commands-grid">
            <div class="command">
                <div class="command-name">/music play</div>
                <div class="command-desc">Play music from multiple sources</div>
            </div>
            <div class="command">
                <div class="command-name">/spotify login</div>
                <div class="command-desc">Connect your Spotify account</div>
            </div>
            <div class="command">
                <div class="command-name">/spotify control</div>
                <div class="command-desc">Control Spotify playback</div>
            </div>
            <div class="command">
                <div class="command-name">/weather</div>
                <div class="command-desc">Get weather information</div>
            </div>
            <div class="command">
                <div class="command-name">/meme</div>
                <div class="command-desc">Get random memes</div>
            </div>
            <div class="command">
                <div class="command-name">/joke</div>
                <div class="command-desc">Tell a dad joke</div>
            </div>
            <div class="command">
                <div class="command-name">/8ball</div>
                <div class="command-desc">Magic 8-ball predictions</div>
            </div>
            <div class="command">
                <div class="command-name">/ping</div>
                <div class="command-desc">Check bot status</div>
            </div>
        </div>
        
        <div class="buttons">
            <a href="https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=3148800&scope=bot%20applications.commands" class="btn">Invite Bot to Server</a>
            <a href="/discord" class="btn spotify">Discord Commands</a>
            <a href="/spotify/guide" class="btn secondary">Spotify Setup</a>
            <a href="/status" class="btn secondary">Bot Status</a>
            <a href="https://github.com/Goge052215/goges-meme-bot" class="btn secondary">GitHub</a>
        </div>
        
        <div class="status">
            <span class="status-indicator">🟢 Online</span> - Bot is operational and ready for commands
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

// Enhanced Spotify OAuth callback handler
async function handleSpotifyCallback(url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  if (error) {
    return handleSpotifyError(error);
  }
  
  if (!code || !state) {
    return handleSpotifyError('missing_parameters');
  }
  
  // Extract Discord user ID from state
  const userId = state.split('_')[0];
  
  try {
    // Try to forward callback to bot server
    // Update this URL to match your deployed bot's domain
    const botServerUrl = env.BOT_SERVER_URL || 'https://your-bot-domain.discloud.app'; // Update this!
    
    console.log(`Attempting to forward callback to bot server: ${botServerUrl}`);
    
    const forwardResponse = await fetch(`${botServerUrl}/spotify/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        state: state,
        userId: userId
      })
    });
    
    if (forwardResponse.ok) {
      const result = await forwardResponse.json();
      if (result.success) {
        return new Response(generateSuccessPage(userId, code, true, false), {
          headers: { 'Content-Type': 'text/html', ...corsHeaders }
        });
      }
    }
    
    // If forwarding failed, use fallback mode
    console.log('Bot server forwarding failed, using fallback mode');
    return new Response(generateSuccessPage(userId, code, false, true), {
      headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
    
  } catch (fetchError) {
    console.error('Failed to forward callback to bot:', fetchError);
    
    // Fallback: Show success page with manual instructions
    return new Response(generateSuccessPage(userId, code, false, true), {
      headers: { 'Content-Type': 'text/html', ...corsHeaders }
    });
  }
}

// Generate success page HTML
function generateSuccessPage(userId, code, botNotified, fallbackMode = false) {
  let statusMessage, statusClass, extraInstructions = '';
  
  if (fallbackMode) {
    statusMessage = '⚠️ Bot server not deployed yet - Manual verification required';
    statusClass = 'warning';
    extraInstructions = `
      <div class="fallback-info">
        <h4>🔄 Manual Verification Required</h4>
        <p>Your Spotify authorization was successful! However, the Discord bot server isn't deployed yet.</p>
        <p><strong>What to do next:</strong></p>
        <ol style="text-align: left; margin: 1rem 2rem;">
          <li><strong>Deploy your bot</strong> to DisCloud first</li>
          <li><strong>Get the actual domain</strong> from DisCloud (e.g., your-app.discloud.app)</li>
          <li><strong>Update Cloudflare Worker</strong> with the correct domain</li>
          <li><strong>Try</strong> <code>/spotify login</code> again in Discord</li>
        </ol>
        <p><strong>Alternative:</strong> Run the bot locally to test OAuth functionality!</p>
      </div>`;
  } else if (botNotified) {
    statusMessage = '✅ Your Discord bot has been notified and your account is now connected!';
    statusClass = 'success';
  } else {
    statusMessage = '⚠️ Connection successful, but please verify in Discord using /spotify status';
    statusClass = 'warning';
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Authentication - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #1DB954; margin-bottom: 1rem; font-size: 2rem; }
        .message { margin-bottom: 2rem; line-height: 1.6; }
        .code-info {
            background: #f0f4f8;
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
            font-family: monospace;
            font-size: 0.9rem;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #1DB954;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #1ed760; }
        .status { margin-top: 2rem; padding: 1rem; border-radius: 8px; }
        .success { background: #e8f5e8; color: #38a169; }
        .warning { background: #fff3cd; color: #856404; }
        .error { background: #fee; color: #c53030; }
        .commands {
            margin-top: 1rem;
            padding: 1rem;
            background: #f8f9fa;
            border-radius: 8px;
            text-align: left;
        }
        .commands code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
        }
        .fallback-info {
            margin-top: 1rem;
            padding: 1.5rem;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            color: #856404;
        }
        .fallback-info h4 {
            color: #856404;
            margin-bottom: 1rem;
        }
        .fallback-info ol {
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵</div>
        <h1>Spotify Authentication</h1>
        
        <div class="status ${statusClass}">
            <strong>${statusMessage}</strong>
        </div>
        
        <div class="code-info">
            <strong>User ID:</strong> ${userId}<br>
            <strong>Auth Code:</strong> ${code.substring(0, 20)}...<br>
            <strong>Status:</strong> ${botNotified ? 'Bot Notified ✅' : 'Manual Verification Required ⚠️'}
        </div>
        
        <div class="commands">
            <strong>Next Steps:</strong><br>
            1. Return to Discord<br>
            2. Use <code>/spotify status</code> to verify connection<br>
            3. Start using enhanced Spotify features!<br><br>
            
            <strong>Available Commands:</strong><br>
            • <code>/spotify control play/pause</code><br>
            • <code>/spotify devices</code><br>
            • <code>/spotify playlists</code><br>
            • <code>/spotify queue &lt;song&gt;</code>
        </div>
        
        <div style="margin-top: 2rem;">
            <a href="/" class="btn">Return to Home</a>
            <a href="/spotify/guide" class="btn">View Guide</a>
        </div>
        
        ${extraInstructions}
    </div>
</body>
</html>`;
}

// Generate error page HTML
function generateErrorPage(title, errorMessage) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Authentication Error - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #dc3545; margin-bottom: 1rem; font-size: 2rem; }
        .error { background: #fee; color: #c53030; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #1DB954;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #1ed760; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">❌</div>
        <h1>${title}</h1>
        <div class="error">
            <strong>Error:</strong> ${errorMessage}
        </div>
        <div>
            <a href="/spotify/guide" class="btn">Setup Guide</a>
            <a href="/spotify/help" class="btn">Get Help</a>
        </div>
    </div>
</body>
</html>`;
}

// Direct OAuth processing (fallback when bot server is unavailable)
async function handleSpotifyOAuthDirect(url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  
  if (error) {
    return handleSpotifyError(error);
  }
  
  if (!code || !state) {
    return handleSpotifyError('missing_parameters');
  }
  
  // Extract Discord user ID from state
  const userId = state.split('_')[0];
  
  // Since we can't directly store tokens in the Worker (stateless),
  // we'll provide instructions for manual verification
  return new Response(generateSuccessPage(userId, code, false, true), {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

// Spotify authentication redirect handler
function handleSpotifyAuthRedirect(url) {
  const userId = url.searchParams.get('user');
  const state = url.searchParams.get('state');
  
  if (!userId) {
    return handleSpotifyError('missing_user_id');
  }
  
  // This would typically redirect to Spotify's OAuth URL
  // In practice, the Discord bot generates this URL and users click it
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Authentication - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #1DB954; margin-bottom: 1rem; font-size: 2rem; }
        .message { margin-bottom: 2rem; line-height: 1.6; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #1DB954;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #1ed760; }
        .info { margin-top: 2rem; padding: 1rem; background: #f0f4f8; border-radius: 8px; color: #4a5568; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵</div>
        <h1>Spotify Authentication</h1>
        <div class="message">
            You're about to connect your Spotify account to Goge's Bot.<br>
            This will enable enhanced music features in Discord.
        </div>
        
        <div style="margin: 2rem 0;">
            <a href="/" class="btn">Continue with Spotify</a>
        </div>
        
        <div class="info">
            <strong>What you'll get:</strong><br>
            • Control Spotify playback from Discord<br>
            • Access your personal playlists<br>
            • Add songs to your Spotify queue<br>
            • Manage devices and playback settings
        </div>
        
        <div style="margin-top: 2rem;">
            <a href="/" style="color: #667eea; text-decoration: none;">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

// Spotify status checker
function handleSpotifyStatus(url) {
  const userId = url.searchParams.get('user');
  
  // This would check the bot's database for user authentication status
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Status - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: white;
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #1DB954; margin-bottom: 1rem; font-size: 2rem; }
        .status { margin: 2rem 0; padding: 1rem; border-radius: 8px; }
        .connected { background: #e8f5e8; color: #38a169; }
        .disconnected { background: #fee; color: #c53030; }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #1DB954;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #1ed760; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵</div>
        <h1>Spotify Connection Status</h1>
        
        <div class="status ${userId ? 'connected' : 'disconnected'}">
            <strong>${userId ? '🟢 Connected' : '🔴 Not Connected'}</strong><br>
            ${userId 
              ? `Your Spotify account is connected and ready to use!` 
              : `Use <code>/spotify login</code> in Discord to connect your account.`
            }
        </div>
        
        <div style="margin-top: 2rem;">
            <a href="/" class="btn">Return to Home</a>
            ${userId ? '' : '<a href="/spotify/auth" class="btn">Connect Spotify</a>'}
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

function handleSpotifyError(error) {
  const errorMessages = {
    'access_denied': 'You denied access to your Spotify account.',
    'missing_parameters': 'Missing required authentication parameters.',
    'missing_user_id': 'User ID not provided in the request.',
    'invalid_state': 'Invalid authentication state parameter.'
  };
  
  const message = errorMessages[error] || 'An unknown error occurred during authentication.';
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Authentication Error</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
            margin: 2rem;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; }
        h1 { color: #e74c3c; margin-bottom: 1rem; font-size: 2rem; }
        .error-message { margin-bottom: 2rem; line-height: 1.6; }
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
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">❌</div>
        <h1>Authentication Error</h1>
        <div class="error-message">
            ${message}
        </div>
        
        <div style="margin-top: 2rem;">
            <a href="/" class="btn">Return to Home</a>
            <a href="/spotify/auth" class="btn">Try Again</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

// Legacy support functions (keep existing implementations)
function handleSpotifyAuth() {
  return new Response(JSON.stringify({ message: 'Use /spotify/auth endpoint' }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
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

// New enhanced subpages
function handleSpotifyGuide() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Setup Guide - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            min-height: 100vh;
            color: white;
            padding: 2rem 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 800px;
            margin: 0 auto;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; text-align: center; }
        h1 { color: #1DB954; margin-bottom: 1rem; font-size: 2.5rem; text-align: center; }
        .step { 
            background: #f8f9fa; 
            padding: 1.5rem; 
            border-radius: 10px; 
            margin: 1.5rem 0;
            border-left: 4px solid #1DB954;
        }
        .step h3 { color: #1DB954; margin-bottom: 1rem; }
        .step p { margin-bottom: 1rem; line-height: 1.6; }
        .step code { 
            background: #e2e8f0; 
            padding: 0.2rem 0.5rem; 
            border-radius: 4px; 
            font-family: monospace;
        }
        .highlight { 
            background: #e8f5e8; 
            padding: 1rem; 
            border-radius: 8px; 
            margin: 1rem 0;
            border: 1px solid #1DB954;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #1DB954;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #1ed760; }
        .btn.secondary { background: #667eea; }
        .btn.secondary:hover { background: #5a67d8; }
        .features { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1rem; 
            margin: 2rem 0; 
        }
        .feature { 
            background: #f0f4f8; 
            padding: 1rem; 
            border-radius: 8px; 
            text-align: center;
        }
        .navigation { text-align: center; margin-top: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🎵</div>
        <h1>Spotify Setup Guide</h1>
        
        <div class="highlight">
            <strong>🎯 Goal:</strong> Connect your personal Spotify account to unlock enhanced music features in Discord!
        </div>
        
        <div class="step">
            <h3>Step 1: Join Discord Server</h3>
            <p>Make sure you're in a Discord server that has Goge's Bot installed. If the bot isn't there yet:</p>
            <p>• Ask a server admin to invite the bot</p>
            <p>• Or invite it yourself if you have permissions</p>
        </div>
        
        <div class="step">
            <h3>Step 2: Start Authentication in Discord</h3>
            <p>In any Discord channel where the bot is available, type:</p>
            <p><code>/spotify login</code></p>
            <p>The bot will provide you with a secure authentication link.</p>
        </div>
        
        <div class="step">
            <h3>Step 3: Complete Spotify OAuth</h3>
            <p>• Click the authentication link from the bot</p>
            <p>• You'll be redirected to Spotify's login page</p>
            <p>• Sign in with your Spotify account</p>
            <p>• Grant permissions to Goge's Bot</p>
            <p>• You'll be redirected back to this website</p>
        </div>
        
        <div class="step">
            <h3>Step 4: Verify Connection</h3>
            <p>Return to Discord and type:</p>
            <p><code>/spotify status</code></p>
            <p>If everything worked, you'll see your Spotify connection status!</p>
        </div>
        
        <h2 style="color: #1DB954; margin: 2rem 0 1rem;">🌟 What You'll Get</h2>
        <div class="features">
            <div class="feature">
                <h4>🎮 Playback Control</h4>
                <p>Play, pause, skip tracks on any device</p>
            </div>
            <div class="feature">
                <h4>📱 Device Management</h4>
                <p>See and control all your Spotify devices</p>
            </div>
            <div class="feature">
                <h4>📝 Playlist Access</h4>
                <p>Browse your personal playlists</p>
            </div>
            <div class="feature">
                <h4>➕ Queue Integration</h4>
                <p>Add songs directly to your Spotify queue</p>
            </div>
        </div>
        
        <div class="highlight">
            <strong>🔐 Security Note:</strong> Your Spotify credentials are never stored by our bot. We only receive temporary access tokens that you can revoke anytime using <code>/spotify logout</code>.
        </div>
        
        <div class="navigation">
            <a href="/discord" class="btn">View Discord Commands</a>
            <a href="/spotify/help" class="btn secondary">Troubleshooting</a>
            <a href="/" class="btn secondary">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

function handleSpotifyHelp() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Spotify Help & Troubleshooting - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
            padding: 2rem 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 900px;
            margin: 0 auto;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; text-align: center; }
        h1 { color: #e74c3c; margin-bottom: 1rem; font-size: 2.5rem; text-align: center; }
        h2 { color: #667eea; margin: 2rem 0 1rem; }
        .issue {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1.5rem 0;
            border-left: 4px solid #e74c3c;
        }
        .issue h3 { color: #e74c3c; margin-bottom: 1rem; }
        .solution {
            background: #e8f5e8;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            border-left: 4px solid #48bb78;
        }
        .solution h4 { color: #48bb78; margin-bottom: 0.5rem; }
        code { 
            background: #e2e8f0; 
            padding: 0.2rem 0.5rem; 
            border-radius: 4px; 
            font-family: monospace;
        }
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
        .btn.spotify { background: #1DB954; }
        .btn.spotify:hover { background: #1ed760; }
        .navigation { text-align: center; margin-top: 2rem; }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">🆘</div>
        <h1>Spotify Help & Troubleshooting</h1>
        
        <div class="warning">
            <strong>💡 Quick Tip:</strong> Most Spotify issues can be resolved by ensuring you have an active Spotify device and the correct permissions!
        </div>
        
        <h2>Common Issues & Solutions</h2>
        
        <div class="issue">
            <h3>❌ "User not authenticated" error</h3>
            <div class="solution">
                <h4>✅ Solution:</h4>
                <p>1. Use <code>/spotify login</code> in Discord</p>
                <p>2. Click the authentication link</p>
                <p>3. Complete the Spotify login process</p>
                <p>4. Return to Discord and try again</p>
            </div>
        </div>
        
        <div class="issue">
            <h3>📱 "No active device found" error</h3>
            <div class="solution">
                <h4>✅ Solution:</h4>
                <p>1. Open Spotify on any device (phone, computer, web player)</p>
                <p>2. Start playing any song</p>
                <p>3. Use <code>/spotify devices</code> to verify device is active</p>
                <p>4. Try your command again</p>
            </div>
        </div>
        
        <div class="issue">
            <h3>💳 "Premium required" error</h3>
            <div class="solution">
                <h4>✅ Solution:</h4>
                <p>Some features (playback control, queue management) require Spotify Premium:</p>
                <p>• Upgrade to Spotify Premium, or</p>
                <p>• Use the Discord bot's music features instead</p>
                <p>• Browse playlists and status features still work with free accounts</p>
            </div>
        </div>
        
        <div class="issue">
            <h3>🔗 Authentication link not working</h3>
            <div class="solution">
                <h4>✅ Solution:</h4>
                <p>1. Try copying the link and opening in a new browser tab</p>
                <p>2. Clear your browser cookies for Spotify</p>
                <p>3. Use an incognito/private browsing window</p>
                <p>4. Make sure you're logged into the correct Spotify account</p>
            </div>
        </div>
        
        <div class="issue">
            <h3>⏱️ Authentication expires or fails</h3>
            <div class="solution">
                <h4>✅ Solution:</h4>
                <p>1. Use <code>/spotify logout</code> to clear old tokens</p>
                <p>2. Wait a few minutes</p>
                <p>3. Use <code>/spotify login</code> to start fresh</p>
                <p>4. Complete authentication within 10 minutes</p>
            </div>
        </div>
        
        <h2>Feature Requirements</h2>
        
        <div class="success">
            <h4>🆓 Works with Spotify Free:</h4>
            <p>• View current playback status</p>
            <p>• Browse your playlists</p>
            <p>• See device information</p>
            <p>• Connect/disconnect account</p>
        </div>
        
        <div class="warning">
            <h4>💳 Requires Spotify Premium:</h4>
            <p>• Control playback (play/pause/skip)</p>
            <p>• Add songs to queue</p>
            <p>• Change volume</p>
            <p>• Device switching</p>
        </div>
        
        <h2>Discord Commands Quick Reference</h2>
        
        <div style="background: #f0f4f8; padding: 1.5rem; border-radius: 10px; margin: 1rem 0;">
            <p><code>/spotify login</code> - Connect your account</p>
            <p><code>/spotify status</code> - Check connection and playback</p>
            <p><code>/spotify control play</code> - Resume playback</p>
            <p><code>/spotify devices</code> - List your devices</p>
            <p><code>/spotify logout</code> - Disconnect account</p>
        </div>
        
        <div class="success">
            <strong>🎯 Still having issues?</strong> Visit our Discord server for live support, or check if the Spotify Web API is experiencing outages.
        </div>
        
        <div class="navigation">
            <a href="/discord" class="btn">Discord Commands</a>
            <a href="/spotify/guide" class="btn">Spotify Setup</a>
            <a href="/spotify/help" class="btn">Troubleshooting</a>
            <a href="/" class="btn">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

function handleDiscordGuide() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Commands Guide - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #7289da 0%, #5865f2 100%);
            min-height: 100vh;
            color: white;
            padding: 2rem 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 1000px;
            margin: 0 auto;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; text-align: center; }
        h1 { color: #5865f2; margin-bottom: 1rem; font-size: 2.5rem; text-align: center; }
        h2 { color: #5865f2; margin: 2rem 0 1rem; border-bottom: 2px solid #5865f2; padding-bottom: 0.5rem; }
        .command-category {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1.5rem 0;
        }
        .command {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .command-name {
            font-family: monospace;
            background: #e2e8f0;
            padding: 0.3rem 0.6rem;
            border-radius: 4px;
            font-weight: bold;
            color: #4a5568;
            display: inline-block;
            margin-bottom: 0.5rem;
        }
        .command-desc { color: #666; margin-bottom: 0.5rem; }
        .command-example { 
            font-size: 0.9rem; 
            color: #718096; 
            font-style: italic; 
        }
        .highlight {
            background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%);
            color: white;
            padding: 1.5rem;
            border-radius: 10px;
            margin: 2rem 0;
            text-align: center;
        }
        .tip {
            background: #e8f4fd;
            border-left: 4px solid #3182ce;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 0 8px 8px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 0.5rem;
            background: #5865f2;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background 0.3s;
        }
        .btn:hover { background: #4752c4; }
        .btn.spotify { background: #1DB954; }
        .btn.spotify:hover { background: #1ed760; }
        .navigation { text-align: center; margin-top: 2rem; }
        .category-icon { font-size: 1.5rem; margin-right: 0.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">💬</div>
        <h1>Discord Commands Guide</h1>
        
        <div class="highlight">
            <h3>🚀 Getting Started</h3>
            <p>All commands use Discord's slash command system. Type <strong>/</strong> in any channel to see available commands!</p>
        </div>
        
        <h2><span class="category-icon">🎵</span>Music Commands</h2>
        
        <div class="command-category">
            <h3>/music - Core Music Features</h3>
            
            <div class="command">
                <div class="command-name">/music play &lt;query&gt;</div>
                <div class="command-desc">Play music from multiple sources (YouTube, SoundCloud, Spotify)</div>
                <div class="command-example">Example: /music play never gonna give you up</div>
            </div>
            
            <div class="command">
                <div class="command-name">/music search &lt;query&gt;</div>
                <div class="command-desc">Interactive song selection with dropdown menu</div>
                <div class="command-example">Example: /music search bohemian rhapsody</div>
            </div>
            
            <div class="command">
                <div class="command-name">/music current</div>
                <div class="command-desc">Show what's currently playing (both Discord bot and your Spotify)</div>
            </div>
            
            <div class="command">
                <div class="command-name">/music pause/resume/skip</div>
                <div class="command-desc">Basic playback controls for Discord bot queue</div>
            </div>
        </div>
        
        <div class="command-category" style="border: 2px solid #1DB954;">
            <h3><span class="category-icon">🎵</span>/spotify - Enhanced Spotify Features (OAuth Required)</h3>
            
            <div class="tip">
                <strong>💡 Setup Required:</strong> Use <code>/spotify login</code> first to connect your Spotify account!
            </div>
            
            <div class="command">
                <div class="command-name">/spotify login</div>
                <div class="command-desc">Connect your Spotify account via secure OAuth</div>
                <div class="command-example">Start here to unlock all Spotify features!</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify status</div>
                <div class="command-desc">Detailed view of your current Spotify playback with track info, device, and progress</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify control &lt;action&gt;</div>
                <div class="command-desc">Control your Spotify playback: play, pause, next, previous, shuffle</div>
                <div class="command-example">Example: /spotify control play volume:75</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify devices</div>
                <div class="command-desc">List all your connected Spotify devices with active status</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify playlists</div>
                <div class="command-desc">Browse your personal Spotify playlists</div>
                <div class="command-example">Example: /spotify playlists limit:15</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify queue &lt;song&gt;</div>
                <div class="command-desc">Add Spotify tracks directly to your personal queue</div>
                <div class="command-example">Example: /spotify queue https://open.spotify.com/track/...</div>
            </div>
            
            <div class="command">
                <div class="command-name">/spotify logout</div>
                <div class="command-desc">Disconnect your Spotify account</div>
            </div>
        </div>
        
        <h2><span class="category-icon">🌤️</span>Weather Commands</h2>
        
        <div class="command-category">
            <div class="command">
                <div class="command-name">/weather &lt;city&gt;</div>
                <div class="command-desc">Get current weather information for any city worldwide</div>
                <div class="command-example">Example: /weather Tokyo</div>
            </div>
        </div>
        
        <h2><span class="category-icon">🎮</span>Entertainment Commands</h2>
        
        <div class="command-category">
            <div class="command">
                <div class="command-name">/meme</div>
                <div class="command-desc">Get random memes from popular subreddits</div>
            </div>
            
            <div class="command">
                <div class="command-name">/joke</div>
                <div class="command-desc">Tell a random dad joke</div>
            </div>
            
            <div class="command">
                <div class="command-name">/8ball &lt;question&gt;</div>
                <div class="command-desc">Ask the magic 8-ball a question</div>
                <div class="command-example">Example: /8ball Will it rain tomorrow?</div>
            </div>
        </div>
        
        <h2><span class="category-icon">🛠️</span>Utility Commands</h2>
        
        <div class="command-category">
            <div class="command">
                <div class="command-name">/ping</div>
                <div class="command-desc">Check bot status and latency</div>
            </div>
            
            <div class="command">
                <div class="command-name">/help</div>
                <div class="command-desc">Get comprehensive help and command information</div>
            </div>
        </div>
        
        <div class="highlight">
            <h3>🔗 Need Help Setting Up Spotify?</h3>
            <p>Visit our step-by-step setup guide to connect your Spotify account and unlock enhanced features!</p>
            <div style="margin-top: 1rem;">
                <a href="/spotify/guide" style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; margin-right: 10px;">📖 Spotify Setup Guide</a>
                <a href="/spotify/help" style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none;">🆘 Troubleshooting</a>
            </div>
        </div>
        
        <div class="navigation">
            <a href="/discord" class="btn">Discord Commands</a>
            <a href="/spotify/guide" class="btn">Spotify Setup</a>
            <a href="/spotify/help" class="btn">Troubleshooting</a>
            <a href="/" class="btn">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
}

function handleGeneralGuide() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complete Bot Guide - Goge's Bot</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: white;
            padding: 2rem 0;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 900px;
            margin: 0 auto;
        }
        .logo { font-size: 4rem; margin-bottom: 1rem; text-align: center; }
        h1 { color: #667eea; margin-bottom: 1rem; font-size: 2.5rem; text-align: center; }
        .section {
            background: #f8f9fa;
            padding: 2rem;
            border-radius: 15px;
            margin: 2rem 0;
            border-left: 4px solid var(--accent-color);
        }
        .music-section { --accent-color: #1DB954; }
        .weather-section { --accent-color: #3498db; }
        .entertainment-section { --accent-color: #e74c3c; }
        .utility-section { --accent-color: #9b59b6; }
        
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
        .navigation { text-align: center; margin-top: 2rem; }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">📚</div>
        <h1>Complete Bot Guide</h1>
        
        <div class="feature-grid">
            <div class="section music-section">
                <h2>🎵 Music Features</h2>
                <p><strong>Discord Bot Playback:</strong> Stream music directly in voice channels from YouTube and SoundCloud</p>
                <p><strong>Spotify Integration:</strong> Control your personal Spotify with OAuth authentication</p>
                <ul style="margin: 1rem 0; padding-left: 2rem;">
                    <li>Multi-source music search</li>
                    <li>Queue management</li>
                    <li>Personal Spotify control</li>
                    <li>Device management</li>
                </ul>
                <a href="/discord" class="btn" style="background: #1DB954;">View Music Commands</a>
            </div>
            
            <div class="section weather-section">
                <h2>🌤️ Weather Information</h2>
                <p>Get real-time weather data for any city worldwide with detailed conditions and forecasts.</p>
                <ul style="margin: 1rem 0; padding-left: 2rem;">
                    <li>Current temperature</li>
                    <li>Humidity & wind data</li>
                    <li>Weather conditions</li>
                    <li>Global city support</li>
                </ul>
            </div>
            
            <div class="section entertainment-section">
                <h2>🎮 Entertainment</h2>
                <p>Fun commands to keep your Discord server lively and entertaining for all members.</p>
                <ul style="margin: 1rem 0; padding-left: 2rem;">
                    <li>Random memes</li>
                    <li>Dad jokes</li>
                    <li>Magic 8-ball</li>
                    <li>Interactive responses</li>
                </ul>
            </div>
            
            <div class="section utility-section">
                <h2>🛠️ Utilities</h2>
                <p>Essential bot management and monitoring tools for server administrators and users.</p>
                <ul style="margin: 1rem 0; padding-left: 2rem;">
                    <li>Bot status monitoring</li>
                    <li>Latency checking</li>
                    <li>Help system</li>
                    <li>Error handling</li>
                </ul>
            </div>
        </div>
        
        <div style="background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%); color: white; padding: 2rem; border-radius: 15px; text-align: center; margin: 2rem 0;">
            <h2>🚀 Quick Start</h2>
            <p style="margin: 1rem 0;">Ready to get started? Follow these simple steps:</p>
            <div style="text-align: left; max-width: 600px; margin: 0 auto;">
                <p><strong>1.</strong> Join a Discord server with the bot</p>
                <p><strong>2.</strong> Type <code>/</code> to see available commands</p>
                <p><strong>3.</strong> Use <code>/spotify login</code> for enhanced music features</p>
                <p><strong>4.</strong> Try <code>/music play &lt;song&gt;</code> to start listening!</p>
            </div>
        </div>
        
        <div class="navigation">
            <a href="/discord" class="btn">Discord Commands</a>
            <a href="/spotify/guide" class="btn" style="background: #1DB954;">Spotify Setup</a>
            <a href="/spotify/help" class="btn">Troubleshooting</a>
            <a href="/" class="btn">← Back to Home</a>
        </div>
    </div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...corsHeaders }
  });
} 