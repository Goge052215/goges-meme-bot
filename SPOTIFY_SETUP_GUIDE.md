# 🎵 Spotify Web API Setup Guide

Your Discord bot now uses Spotify's official Web API for music playback control. This provides a much better experience than streaming through yt-dlp and leverages Discord's native Spotify integration.

## 🚀 Quick Overview

With this setup, your bot will:
- ✅ Search Spotify directly for tracks
- ✅ Control user's Spotify playback (play, pause, skip, etc.)
- ✅ Add songs to user's Spotify queue
- ✅ Show currently playing track information
- ✅ Work seamlessly with Discord's Spotify integration
- ✅ No more YouTube bot detection issues!

## 📋 Prerequisites

1. **Spotify Premium Account** - Required for playback control
2. **Active Spotify Session** - User must have Spotify open on a device
3. **Spotify Developer App** - For API credentials

## 🔧 Step 1: Create Spotify Developer App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in with your Spotify account
3. Click "Create an App"
4. Fill in the details:
   - **App Name**: `Discord Music Bot`
   - **App Description**: `Discord bot for music playback control`
   - **Website**: `http://localhost:3000` (or your actual website)
   - **Redirect URI**: `http://localhost:3000/callback`
5. Agree to terms and click "Create"
6. Note down your **Client ID** and **Client Secret**

## 🔑 Step 2: Configure Environment Variables

Update your `config.env` file:

```env
# Existing Discord config
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id

# Add Spotify configuration
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
```

## 🎯 Step 3: Get User Authorization (One-time Setup)

Since this bot controls **user's** Spotify playback, you need to authorize it:

### Option A: Simple Authorization Flow

1. Replace the values in this URL with your Client ID:
```
https://accounts.spotify.com/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&scope=user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative
```

2. Open this URL in your browser
3. Log in to Spotify and authorize the app
4. You'll be redirected to `localhost:3000/callback?code=...`
5. Copy the `code` parameter from the URL

### Option B: Use Authorization Script

Create `auth_spotify.js`:

```javascript
const SpotifyWebApi = require('spotify-web-api-node');
require('dotenv').config({ path: './config.env' });

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Required scopes for full functionality
const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state', 
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative'
];

console.log('🎵 Spotify Authorization URL:');
console.log(spotifyApi.createAuthorizeURL(scopes));
console.log('\n1. Open this URL in your browser');
console.log('2. Log in and authorize the app'); 
console.log('3. Copy the code from the redirect URL');
console.log('4. Use it to get your access token');
```

## 🔄 Step 4: Initialize Bot with Spotify

Update your main bot file to initialize Spotify:

```javascript
const { initializeSpotifyApi, setAccessToken } = require('./media/spotifyUtils');

// Initialize Spotify API
if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
    console.log('🎵 Initializing Spotify integration...');
    initializeSpotifyApi();
    
    // You'll need to set the access token (see Step 5)
    // setAccessToken('your_access_token_here');
} else {
    console.warn('⚠️ Spotify credentials not found. Music features will be limited.');
}
```

## 🎵 Step 5: How Users Authorize the Bot

For the bot to control a user's Spotify, they need to authorize it. You have several options:

### Option 1: Manual Token Setup (Simplest)
1. User authorizes via the URL from Step 3
2. You manually add their access token to the bot
3. Good for personal use or small servers

### Option 2: Web Interface (Recommended)
Create a simple web server for authorization:

```javascript
const express = require('express');
const app = express();

app.get('/auth', (req, res) => {
    const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
    const authURL = `https://accounts.spotify.com/authorize?client_id=${process.env.SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${process.env.SPOTIFY_REDIRECT_URI}&scope=${scopes}`;
    res.redirect(authURL);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    // Exchange code for access token and save it
    res.send('✅ Spotify authorized! You can now use music commands.');
});

app.listen(3000, () => {
    console.log('🌐 Auth server running on http://localhost:3000');
});
```

## 🎮 Usage Instructions

Once set up, users can:

### Basic Commands
- `/music play <song>` - Search and play music on Spotify
- `/music play <song> queue:true` - Add to Spotify queue
- `/music current` - Show currently playing track
- `/music pause` - Pause Spotify playback
- `/music resume` - Resume Spotify playback
- `/music skip` - Skip to next track
- `/music previous` - Go to previous track
- `/music devices` - Show available Spotify devices

### Requirements for Users
1. **Spotify Premium** - Required for playback control
2. **Active Spotify Session** - Must have Spotify open on a device
3. **Authorization** - Must authorize the bot once

## 🔧 Troubleshooting

### "No active Spotify session" Error
- User needs to open Spotify app on any device
- Must be playing something or have recently played something
- Check `/music devices` to see available devices

### "Failed to play on Spotify" Error
- User may not have Spotify Premium
- Bot may not be authorized for that user
- User's Spotify session may be inactive

### Bot Not Finding Songs
- The search is Spotify-focused now
- Searches will only return Spotify tracks
- SoundCloud is available as fallback for non-Spotify content

### Authorization Issues
- Check Client ID and Client Secret are correct
- Ensure redirect URI matches exactly (including http/https)
- Required scopes: `user-read-playback-state user-modify-playback-state user-read-currently-playing`

## 🎯 Benefits of This Approach

1. **No YouTube Issues** - No more bot detection or cookie problems
2. **Native Discord Integration** - Shows up as "Listening to Spotify" 
3. **Better User Experience** - Direct control of user's Spotify
4. **Reliable** - Uses official Spotify API
5. **Feature Rich** - Full playback control (pause, skip, queue, etc.)

## 📝 Technical Notes

- Uses `spotify-web-api-node` library
- Implements OAuth 2.0 authorization flow
- Requires user consent for playback control
- Works with any Spotify Premium account
- Integrates with Discord's activity display

## 🔗 Useful Links

- [Spotify Web API Documentation](https://developer.spotify.com/documentation/web-api/)
- [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- [Authorization Guide](https://developer.spotify.com/documentation/general/guides/authorization/)
- [Scopes Documentation](https://developer.spotify.com/documentation/general/guides/scopes/)

---

Your bot is now ready to provide a premium Spotify experience through Discord! 🎵✨ 