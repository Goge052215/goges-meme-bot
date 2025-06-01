# 🎵 Discord Music Bot - Complete Setup Guide
### Integrated Spotify Authorization Server

This Discord bot now includes a **built-in Spotify authorization server** that starts automatically - no need to run multiple processes!

---

## 📋 Quick Setup Checklist

### 1️⃣ **Discord Bot Setup**
- ✅ Create Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
- ✅ Create bot and copy token to `config.env`
- ✅ Enable required bot permissions (Send Messages, Use Slash Commands, Connect to Voice, Speak)

### 2️⃣ **Spotify Integration Setup**
- ✅ Create Spotify app at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- ✅ Add `http://localhost:3001/callback` to Spotify app's redirect URIs
- ✅ Copy Client ID and Secret to `config.env`

### 3️⃣ **Installation**
```bash
npm install
npm start
```

---

## 🚀 What's New in This Version

### **Integrated Authorization Server**
- 🔄 **Automatic startup** - Web server starts with the bot
- 🎨 **Beautiful web interface** - Modern, user-friendly authorization page
- 📱 **Mobile friendly** - Works on all devices
- 🔒 **Secure token management** - Automatic token refresh and storage
- 📊 **Status monitoring** - Built-in status endpoints

### **Enhanced User Experience**
- ✨ **One-click setup** - Users just visit a web page
- 🎵 **Instant feedback** - Real-time authorization status
- 📋 **Clear instructions** - Step-by-step guidance
- 🔗 **Direct links** - Easy access to authorization

---

## 🔧 Detailed Setup Instructions

### **Step 1: Discord Bot Configuration**

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and name your bot
3. Go to **"Bot"** section
4. Click **"Reset Token"** and copy the token
5. Update `config.env`:
   ```
   DISCORD_TOKEN=your_discord_token_here
   ```

### **Step 2: Spotify App Configuration**

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click **"Create an App"**
3. Fill in name and description
4. In **"Redirect URIs"**, add:
   ```
   http://localhost:3001/callback
   ```
5. Save and copy **Client ID** and **Client Secret**
6. Update `config.env`:
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   ```

### **Step 3: Bot Installation**

1. Clone or download the bot files
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the bot:
   ```bash
   npm start
   ```

### **Step 4: User Authorization**

**For Discord Users:**
1. When the bot starts, it will display: `🌐 Spotify Authorization Server running on http://localhost:3001`
2. Visit that URL in your browser
3. Click **"Authorize Spotify Access"**
4. Log in to Spotify and approve the bot
5. You're done! Use `/music` commands in Discord

---

## 🎵 Available Commands

### **Music Control**
- `/music play [song]` - Search and play music
- `/music pause` - Pause Spotify playback
- `/music resume` - Resume Spotify playback
- `/music skip` - Skip to next track
- `/music previous` - Go to previous track
- `/music current` - Show current track
- `/music devices` - Show Spotify devices

### **Other Features**
- `/ping` - Check bot latency
- `/help` - Show all commands
- `/weather [city]` - Get weather information
- `/joke` - Get a random joke
- `/meme` - Get a random meme

---

## ⚙️ Configuration Options

### **Environment Variables**

```bash
# Required
DISCORD_TOKEN=your_discord_token
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret

# Optional (with defaults)
SPOTIFY_AUTH_PORT=3001
SPOTIFY_REDIRECT_URI=http://localhost:3001/callback
WEATHER_API_KEY=your_weather_api_key
```

### **Port Configuration**
- Default authorization port: `3001`
- Change port: Set `SPOTIFY_AUTH_PORT=your_port` in `config.env`
- Remember to update Spotify app redirect URI if you change the port

### **Production Deployment**
For production servers, update:
```bash
SPOTIFY_REDIRECT_URI=https://yourdomain.com:3001/callback
```
And add this URL to your Spotify app's redirect URIs.

---

## 🛠️ Troubleshooting

### **Common Issues**

**"Authorization server disabled"**
- ✅ Check `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in `config.env`
- ✅ Ensure values don't have quotes or extra spaces

**"Failed to authorize"**
- ✅ Verify redirect URI in Spotify app matches exactly
- ✅ Check if port 3001 is available
- ✅ Ensure you're using the correct authorization URL

**"No active Spotify session"**
- ✅ Open Spotify on any device (phone, computer, web player)
- ✅ Make sure you have Spotify Premium
- ✅ Try playing a song first, then use bot commands

**Commands not working**
- ✅ Invite bot with proper permissions
- ✅ Check if slash commands are registered (wait 5 minutes after startup)
- ✅ Verify user has authorized Spotify access

### **Debug Information**

Check authorization status:
```
GET http://localhost:3001/status
```

Console logs show:
- ✅ `Spotify Authorization Server running` - Server started
- ✅ `Spotify user authorized: [name]` - User completed auth
- ❌ `Spotify credentials not found` - Check config.env

---

## 🔒 Security Notes

- **Never share** your `config.env` file
- **Token storage** is in-memory only (resets on bot restart)
- **HTTPS recommended** for production deployment
- **Firewall rules** may be needed for external access

---

## 🆘 Support

### **Need Help?**
1. Check the troubleshooting section above
2. Verify all environment variables are set correctly
3. Ensure Spotify app redirect URI matches exactly
4. Make sure you have Spotify Premium

### **Still Having Issues?**
- Check console logs for specific error messages
- Verify bot permissions in Discord server
- Test authorization flow step by step
- Ensure all dependencies are installed

---

## 🎉 Success Indicators

**Everything is working when you see:**
```
✅ Spotify API initialized successfully
✅ Spotify authorization server started
🌐 Spotify Authorization Server running on http://localhost:3001
🔗 Users can authorize at the web interface
Successfully registered X application commands
DONE | Meme Bot is up and running
```

**Users are authorized when you see:**
```
✅ Spotify user authorized: [Username] ([spotify_id])
🔑 Token expires: [date/time]
```

Now your Discord music bot is ready with full Spotify integration! 🎵 