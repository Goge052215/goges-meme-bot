# 🤖 Goge's Discord Everything Bot

A powerful, feature-rich Discord bot that handles music streaming, weather information, entertainment, and utilities. Now with **enhanced Spotify OAuth integration** for personalized music experiences!

## ✨ Key Features

### 🎵 **Advanced Music System**
- **Multi-source streaming**: Spotify, YouTube, SoundCloud
- **Personal Spotify Integration**: OAuth-powered user authentication
- **Smart queue management** with prebuffering and fallback systems
- **Intelligent error recovery** and automatic source switching

### 🔐 **Spotify OAuth Features** (NEW!)
- **Personal account connection** via OAuth 2.0
- **Playback control**: Play, pause, skip, volume, shuffle
- **Device management**: View and control all your Spotify devices
- **Personal playlists**: Access your saved playlists
- **Queue integration**: Add songs directly to your Spotify queue
- **Real-time status**: View current playback across both Discord and Spotify

### 🌤️ **Weather Information**
- Real-time weather data for any city worldwide
- Temperature, humidity, wind speed, and conditions
- Beautiful weather displays with emoji indicators

### 🎮 **Entertainment & Fun**
- Random memes from popular subreddits
- Dad jokes and humor
- Magic 8-ball predictions
- Interactive responses

### 🛠️ **Utilities**
- Bot status and latency monitoring
- Comprehensive help system
- User-friendly error handling
- Modern slash command interface

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ installed
- Discord Application with bot token
- Spotify Application (for music features)
- OpenWeatherMap API key (optional, for weather)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd goges_memebot
   npm install
   ```

2. **Configure environment variables**
   ```bash
   cp config.env.example config.env
   # Edit config.env with your tokens and API keys
   ```

3. **Set up Spotify OAuth** (for enhanced features)
   - Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Create or edit your app
   - Add redirect URI (choose your deployment option):
     - **Cloudflare Workers** (Recommended): `https://gogesbot.workers.dev/spotify/callback`
     - **DisCloud**: `https://your-app-name.discloud.app/spotify/callback`
   - Update `SPOTIFY_REDIRECT_URI` in `config.env`

4. **Deploy OAuth Handler**
   
   **Option A: Cloudflare Workers (Recommended)**
   ```bash
   # Configure wrangler with your Cloudflare account
   npx wrangler publish
   ```
   
   **Option B: DisCloud**
   ```bash
   # Deploy the web interface alongside your bot
   # Ensure your DisCloud app can handle web requests
   ```

5. **Start the bot**
   ```bash
   node replit_memebot.js
   ```

## 📱 Commands Overview

### 🎵 Music Commands

#### `/music` - Core music functionality
- **`/music play <query>`** - Play music from multiple sources
  - `spotify_queue: true` - Add to your personal Spotify queue (requires authentication)
- **`/music search <query>`** - Interactive song selection with dropdown menu
- **`/music current`** - Show current playback (both Discord and Spotify)
- **`/music pause/resume/skip/previous`** - Basic playback controls for Discord

#### `/spotify` - Enhanced Spotify features (NEW!)
- **`/spotify login`** - Connect your Spotify account via OAuth
- **`/spotify logout`** - Disconnect your account
- **`/spotify status`** - Detailed playback status with track info
- **`/spotify control <action>`** - Control your Spotify playback
  - Actions: `play`, `pause`, `next`, `previous`, `shuffle`
  - Optional: `volume` (0-100)
- **`/spotify devices`** - List all your connected Spotify devices
- **`/spotify playlists`** - Browse your personal playlists
- **`/spotify queue <song>`** - Add Spotify tracks to your queue

### 🌤️ Weather Commands
- **`/weather <city>`** - Get current weather for any city

### 🎮 Entertainment Commands
- **`/meme`** - Get random memes
- **`/joke`** - Tell a dad joke
- **`/8ball <question>`** - Magic 8-ball predictions

### 🛠️ Utility Commands
- **`/ping`** - Check bot status and latency
- **`/help`** - Comprehensive command guide

## 🔐 Spotify OAuth Setup Guide

### For Users (Connecting Your Account)

1. **Start Authentication**
   ```
   /spotify login
   ```

2. **Complete OAuth Flow**
   - Click the authentication link
   - Sign in to your Spotify account
   - Grant permissions to the bot
   - Return to Discord

3. **Verify Connection**
   ```
   /spotify status
   ```

4. **Start Using Enhanced Features**
   - Control your Spotify playback from Discord
   - Access your personal playlists
   - Add songs to your Spotify queue
   - Manage devices and volume

### For Developers (Bot Setup)

1. **Spotify Application Setup**
   ```
   1. Visit https://developer.spotify.com/dashboard
   2. Create new app or edit existing
   3. Add redirect URI based on your deployment:
      - Cloudflare Workers: https://your-worker-name.workers.dev/spotify/callback
      - DisCloud: https://your-app-name.discloud.app/spotify/callback
   4. Note your Client ID and Client Secret
   ```

2. **Environment Configuration**
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   # Choose your deployment option:
   SPOTIFY_REDIRECT_URI=https://gogesbot.workers.dev/spotify/callback
   ```

3. **OAuth Handler Deployment**
   
   **Option A: Cloudflare Workers (Recommended)**
   - Provides reliable OAuth callback handling
   - Deploy using `npx wrangler publish`
   - Update redirect URI to match your worker domain
   
   **Option B: DisCloud Web Server**
   - Set up Express.js server to handle callbacks
   - Deploy alongside your Discord bot
   - Update redirect URI to match your DisCloud domain

## 🏗️ Architecture

### Core Components

```
├── commands/              # Discord slash commands
│   ├── music.js          # Music playback and search
│   ├── spotify.js        # OAuth Spotify integration (NEW!)
│   ├── weather.js        # Weather information
│   └── ...               # Entertainment and utility commands
├── media/                # Music streaming system
│   ├── spotifyUtils.js   # Enhanced Spotify API with OAuth
│   ├── musicAggregator.js # Multi-source music search
│   ├── streamManager.js  # Audio streaming and queue management
│   ├── cookieManager.js  # Automated cookie management
│   └── queueManager.js   # Queue state management
├── cloudflare-worker.js  # OAuth web interface
└── replit_memebot.js     # Main bot entry point
```

### Data Flow

1. **Music Search**: Multi-source aggregation with intelligent fallbacks
2. **OAuth Flow**: Secure token management with automatic refresh
3. **Streaming**: Smart prebuffering and error recovery
4. **Queue Management**: Separate Discord and Spotify queue systems

## 🔧 Configuration

### Required Environment Variables

```env
# Discord
DISCORD_TOKEN=your_discord_bot_token

# Spotify (Enhanced features)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REDIRECT_URI=https://your-domain.workers.dev/spotify/callback

# Weather (Optional)
WEATHER_API_KEY=your_openweather_api_key
```

### Optional Configuration

```env
# Performance monitoring
DEBUG_PERFORMANCE=false

# Bot settings
MAX_QUEUE_SIZE=50
```

## 🚀 Deployment Options

### Cloudflare Workers (Recommended for OAuth)
- **Advantages**: 
  - Superior OAuth callback reliability
  - Global CDN distribution
  - Better uptime for authentication flows
  - Free tier available
- **Setup**: Deploy `cloudflare-worker.js` using Wrangler CLI
- **Domain**: `https://your-worker-name.workers.dev`

### DisCloud (Alternative)
- **Type**: `bot` (for Discord bot only)
- **RAM**: 256MB minimum, 512MB recommended
- **Auto-restart**: Enabled
- **OAuth**: Requires custom web server setup for callbacks
- **Domain**: `https://your-app-name.discloud.app`

### Hybrid Deployment (Recommended)
- **Bot**: Host on DisCloud for 24/7 operation
- **OAuth**: Use Cloudflare Workers for reliable authentication
- **Configuration**: Set `SPOTIFY_REDIRECT_URI=https://gogesbot.workers.dev/spotify/callback`

### Self-Hosted
- Node.js 16+ environment
- Persistent storage for token management
- Web server for OAuth callbacks (Express.js recommended)

## 🔒 Security Features

- **OAuth 2.0**: Secure Spotify authentication
- **Token Management**: Automatic refresh and secure storage
- **Rate Limiting**: API call optimization and abuse prevention
- **Input Validation**: Sanitized user inputs and URL validation
- **Process Management**: Safe external process handling

## 🆘 Troubleshooting

### Common Issues

**"User not authenticated" errors**
```
Solution: Use /spotify login to connect your account
```

**"No active Spotify device" errors**
```
Solutions:
1. Open Spotify on any device
2. Start playing something
3. Try the command again
```

**OAuth callback failures**
```
Solutions:
1. Check redirect URI matches exactly
2. Verify Cloudflare Worker is deployed
3. Ensure Spotify app settings are correct
```

**Music playback issues**
```
Solutions:
1. Check bot permissions in voice channel
2. Try different music source
3. Use /spotify login for enhanced features
```

### Debug Mode

Enable detailed logging:
```env
DEBUG_PERFORMANCE=true
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Guidelines

- Follow existing code patterns
- Add comprehensive error handling
- Update documentation for new features
- Test OAuth flows thoroughly
- Maintain backward compatibility

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Spotify Web API** - For music streaming capabilities
- **Discord.js** - For Discord bot framework
- **OpenWeatherMap** - For weather data
- **Cloudflare Workers** - For OAuth web interface
- **youtube-dl-exec** - For media extraction

## 📞 Support

- **Issues**: Use GitHub Issues for bug reports
- **Features**: Submit feature requests via GitHub
- **Documentation**: Check README and code comments
- **Community**: Join our Discord server for support

---

**Made with ❤️ by Goge | Enhanced with Spotify OAuth Integration** 