# 🎵 Goge's Discord Music Bot

A powerful Discord music bot with multi-source streaming capabilities, supporting Spotify, YouTube, and SoundCloud integration with intelligent fallback systems.

## ✨ Features

- 🎧 **Multi-Source Streaming**: Play music from Spotify, YouTube, and SoundCloud
- 🔍 **Interactive Search**: Select from multiple song versions with dropdown menus
- ⚡ **Smart Fallbacks**: Automatic source switching when one fails
- 🍪 **Auto Cookie Management**: Automated YouTube cookie refresh system
- 🎯 **Slash Commands**: Modern Discord UI with `/` commands
- 📱 **Web Interface**: Cloudflare Workers-powered web endpoints
- 🚀 **Optimized Hosting**: Low RAM usage (256MB) on DisCloud

## 🏗️ Architecture

### **Bot Hosting** (DisCloud)
- **Type**: BOT (optimized for low RAM usage)
- **RAM**: 256MB
- **Features**: Discord interactions, music streaming, voice channels

### **Web Interface** (Cloudflare Workers)
- **Domain**: `gogesbot.workers.dev` (+ custom domain when approved)
- **Features**: OAuth callbacks, status API, landing page
- **Cost**: Free tier (100K requests/day)

## 📋 Prerequisites

- Node.js 18+
- Discord Bot Token
- Spotify API credentials (Client ID + Secret)
- DisCloud account for hosting
- Cloudflare account for web endpoints

## 🚀 Quick Setup

### 1. Environment Configuration

Create a `config.env` file:
```bash
# Discord Bot Token
DISCORD_TOKEN=your_discord_bot_token_here

# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Optional: Weather API Key
WEATHER_API_KEY=your_openweather_api_key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Locally

```bash
npm start
```

## 🌐 Deployment

### **Discord Bot → DisCloud**

1. **Prepare deployment**:
   ```bash
   npm run build  # Creates optimized zip file
   ```

2. **Upload to DisCloud**:
   - Upload `goges_memebot.zip`
   - Configuration already set in `discloud.config`

### **Web Interface → Cloudflare Workers**

1. **Deploy worker**:
   - Copy code from `cloudflare-worker.js`
   - Paste in Cloudflare Workers dashboard
   - Deploy to `gogesbot.workers.dev`

## 🎮 Commands

| Command | Description |
|---------|-------------|
| `/music play <song>` | Play a song from any supported platform |
| `/music search <query>` | Interactive search with multiple results |
| `/music queue` | Show current music queue |
| `/music skip` | Skip current song |
| `/music stop` | Stop music and clear queue |
| `/music leave` | Disconnect bot from voice channel |
| `/weather <city>` | Get weather information |

## 🔧 Technical Details

### **Music Sources Priority**
1. **Spotify** → Metadata + YouTube stream
2. **YouTube** → Direct streaming
3. **SoundCloud** → Fallback with cookies
4. **Hardcoded** → Last resort for popular songs

### **Error Handling**
- Automatic cookie refresh for YouTube/SoundCloud
- Source fallback chain for failed requests
- Process cleanup to prevent memory leaks
- Graceful degradation when services are down

### **Performance Optimizations**
- Client Credentials flow (no user auth required)
- Minimal RAM footprint (256MB)
- Efficient audio streaming
- Smart caching for search results

## 📁 Project Structure

```
├── commands/              # Discord slash commands
│   ├── music.js          # Music playback commands
│   ├── search.js         # Interactive search command
│   └── weather.js        # Weather command
├── media/                # Music streaming logic
│   ├── cookieManager.js  # Automated cookie management
│   ├── musicAggregator.js # Multi-source search
│   ├── queueManager.js   # Queue management
│   ├── spotifyUtils.js   # Spotify API integration
│   └── streamManager.js  # Audio streaming
├── cloudflare-worker.js  # Web interface (Cloudflare)
├── replit_memebot.js     # Main bot entry point
├── discloud.config       # DisCloud deployment config
└── package.json          # Dependencies and scripts
```

## 🌍 Domains

- **Primary**: `gogesbot.discloud.app` (DisCloud subdomain)
- **Web Interface**: `gogesbot.workers.dev` (Cloudflare Workers)
- **Custom Domain**: `gogesbot.net.eu.org` (pending approval)

## 🛠️ Development

### **Local Development**
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Create deployment package
npm run build
```

### **Adding New Commands**
1. Create command file in `commands/`
2. Export with proper Discord.js structure
3. Restart bot to register new commands

### **Adding Music Sources**
1. Add source logic to `media/musicAggregator.js`
2. Update fallback chain in priority order
3. Test with various song types

## 📊 Monitoring

- **Bot Status**: `/status` endpoint on worker
- **Health Check**: Automatic restart on DisCloud
- **Error Logging**: Console output for debugging

## 🔒 Security

- **Token Protection**: Never commit `config.env`
- **Input Validation**: All user inputs sanitized
- **Process Isolation**: Safe external command execution
- **Rate Limiting**: Respects Discord API limits

## 📝 License

MIT License - feel free to use and modify for your own projects!

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

- **Issues**: Create GitHub issues for bugs
- **Features**: Request new features via GitHub
- **Discord**: Join support server (link coming soon)

---

Made with ❤️ by Goge | Powered by DisCloud & Cloudflare 