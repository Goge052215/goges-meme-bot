require('dotenv').config({ path: './config.env' });
const { createInterface } = require('node:readline');
const { execSync } = require('child_process');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { cookieManager } = require('./media/cookieManager');
const { initializeSpotifyApi, setAccessToken } = require('./media/spotifyUtils');
const keepAlive = require('./keep_alive');

const { loadCommands } = require('./commands/index');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ] 
});
const rl = createInterface({ input: process.stdin, output: process.stdout });

client.commands = new Collection();
const { commands, commandFiles } = loadCommands();
console.log(`Loaded ${commands.length} commands: ${Object.keys(commandFiles).join(', ')}`);

for (const [name, command] of Object.entries(commandFiles)) {
  client.commands.set(name, command);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  if (message.content.startsWith('$')) {
    message.channel.send("This bot now uses slash (/) commands instead of text commands. Type / in the chat to see available commands.");
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  console.log(`Received command: ${interaction.commandName}`);

  if (!command) {
    console.log(`Command not found: ${interaction.commandName}`);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Command not found!', ephemeral: true });
      }
    } catch (err) {
      console.error('Error replying to invalid command:', err);
    }
    return;
  }

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    
    const errorMessage = 'There was an error while executing this command!';
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: errorMessage, ephemeral: true });
      } else if (!interaction.replied) {
        await interaction.reply({ content: errorMessage, ephemeral: true });
      } else {
        await interaction.followUp({ content: errorMessage, ephemeral: true });
      }
    } catch (replyError) {
      console.error('Error handling failed command in main handler:', replyError);
    }
  }
});

function loadToken() {
  try {
    const configPath = path.join(__dirname, 'config.env');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf8');
      const tokenMatch = config.match(/DISCORD_TOKEN=(.+)/);
      if (tokenMatch && tokenMatch[1]) {
        return tokenMatch[1].trim();
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading token from config file:', error);
    return null;
  }
}

const question = (q) => new Promise((resolve) => rl.question(q, resolve));
(async () => {
  let token = loadToken();
  
  if (!token) {
    console.log('No token found in config.env file.');
    token = await question('Application token? ');
    
    const saveToken = await question('Do you want to save this token for next time? (y/n) ');
    if (saveToken.toLowerCase() === 'y') {
      try {
        const weatherApiKey = process.env.WEATHER_API_KEY || '';
        fs.writeFileSync('config.env', `# Discord Bot Token\nDISCORD_TOKEN=${token}\n\n# OpenWeatherMap API Key\nWEATHER_API_KEY=${weatherApiKey}\n\n# Don't share this file or upload it to public repositories!`);
        console.log('Token saved to config.env file.');
      } catch (error) {
        console.error('Error saving token to config file:', error);
      }
    }
  } else {
    console.log('Token loaded from config.env file.');
  }
  
  if (!token) throw new Error('Invalid token');

  const ratelimitTest = await fetch(`https://discord.com/api/v10/invites/discord-developers`);

  if (!ratelimitTest.ok) {
    await question(`Uh oh, looks like the node you're on is currently being blocked by Discord. Press the "Enter" button on your keyboard to be reassigned to a new node. (you'll need to rerun the program once you reconnect)`)
    execSync('kill 1');
    return;
  };
  
  await client.login(token).catch((err) => {
    throw err
  });

  console.log('Initializing simplified cookie manager for SoundCloud fallback...');
  try {
    await cookieManager.initialize();
    console.log('Cookie manager initialized successfully');
  } catch (cookieError) {
    console.error('Cookie manager initialization failed:', cookieError.message);
    console.log('Bot will continue with limited fallback capabilities');
  }

  console.log('Initializing Spotify Web API integration...');
  try {
    if (process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET) {
      const spotifyInitialized = initializeSpotifyApi();
      if (spotifyInitialized) {
        console.log('Spotify API initialized successfully');
      } else {
        console.warn('Spotify API initialization failed');
      }
    } else {
      console.warn('Spotify credentials not found in config.env');
    }
  } catch (spotifyError) {
    console.error('Spotify initialization error:', spotifyError.message);
  }

  const rest = new REST({ version: '10' }).setToken(token);
  
  try {
    console.log('Started refreshing application (/) commands.');
    console.log(`Registering ${commands.length} commands: ${commands.map(cmd => cmd.name).join(', ')}`);
    
    const registrationResult = await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    
    console.log(`Successfully registered ${registrationResult.length} application commands.`);
    console.log('Registered commands:', registrationResult.map(cmd => `/${cmd.name}`).join(', '));
  } catch (error) {
    console.error('Failed to register application commands:', error);
    console.error(error);
  }

  console.log('DONE | Meme Bot is up and running. DO NOT CLOSE THIS TAB UNLESS YOU ARE FINISHED USING THE BOT, IT WILL PUT THE BOT OFFLINE.');
  
  // Start the Express server for OAuth callbacks and health checks
  keepAlive();
})();

// Cleanup on bot shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down bot...');
  cookieManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nBot terminated...');
  cookieManager.cleanup();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  if (error.message && (
    error.message.includes('SIGKILL') || 
    error.message.includes('ChildProcessError') ||
    error.message.includes('youtube-dl-exec')
  )) {
    console.log('Ignoring yt-dlp process termination error');
    return;
  }
  console.log('Critical error occurred, shutting down...');
  cookieManager.cleanup();
  process.exit(1);
}); 