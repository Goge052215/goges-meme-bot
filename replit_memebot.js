require('dotenv').config({ path: './config.env' });
const { createInterface } = require('node:readline');
const { execSync } = require('child_process');
const fetch = require('node-fetch');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { cookieManager } = require('./media/cookieManager');
const { initializeSpotifyApi } = require('./media/spotifyUtils');
const { keepAlive } = require('./keep_alive');

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

client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      console.error(error);
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true
      }).catch(console.error);
    }
  }
  
  if (interaction.isButton() && interaction.customId.startsWith('spotify_')) {
    try {
      const [action, userId] = interaction.customId.split('_').slice(1);
      
      if (userId !== interaction.user.id) {
        return interaction.reply({
          content: 'This button is not for you to use.',
          ephemeral: true
        });
      }
      
      await interaction.deferUpdate();
      
      const { isUserAuthenticated, controlUserPlayback } = require('./worker-kv-interface');
      const isAuthenticated = await isUserAuthenticated(userId);
      
      if (!isAuthenticated) {
        return interaction.followUp({
          content: 'Your Spotify account is no longer connected. Use `/spotify login` to reconnect.',
          ephemeral: true
        });
      }
      
      if (action === 'devices') {
        const devicesCommand = client.commands.get('spotify');
        const fakeInteraction = {
          ...interaction,
          options: {
            getSubcommand: () => 'devices'
          },
          deferReply: async (opts) => {},
          editReply: async (opts) => interaction.followUp({ ...opts, ephemeral: true })
        };
        
        await devicesCommand.execute(fakeInteraction, client);
        return;
      }
      
      await controlUserPlayback(userId, action);
      
      const actionMessages = {
        play: '▶️ Playback resumed',
        pause: '⏸️ Playback paused',
        next: '⏭️ Skipped to next track',
        previous: '⏮️ Skipped to previous track'
      };
      
      await interaction.followUp({
        content: actionMessages[action] || 'Playback control executed',
        ephemeral: true
      }).catch(console.error);
    } catch (error) {
      console.error('[Spotify Button]', error);
      await interaction.followUp({
        content: `Error: ${error.message}`,
        ephemeral: true
      }).catch(console.error);
    }
  }
});

const question = (q) => new Promise((resolve) => rl.question(q, resolve));
(async () => {
  let token = process.env.DISCORD_TOKEN;
  
  if (!token) {
    console.log('No DISCORD_TOKEN found in environment. Please provide one.');
    token = await question('Application token? ');
    
    const saveToken = await question('Do you want to save this token to config.env for next time? (y/n) ');
    if (saveToken.toLowerCase() === 'y') {
      try {
        const envContent = fs.existsSync('config.env') ? fs.readFileSync('config.env', 'utf8') : '';
        let newContent;
        if (envContent.includes('DISCORD_TOKEN')) {
          newContent = envContent.replace(/DISCORD_TOKEN=.*/, `DISCORD_TOKEN=${token}`);
        } else {
          newContent = envContent + `\nDISCORD_TOKEN=${token}\n`;
        }
        fs.writeFileSync('config.env', newContent);
        console.log('Token saved to config.env file.');
      } catch (error) {
        console.error('Error saving token to config file:', error);
      }
    }
  } else {
    console.log('Token loaded successfully from environment.');
  }
  
  if (!token || token.length < 50) {
    console.error('❌ Invalid or missing Discord token. Please set DISCORD_TOKEN in your config.env file or in your hosting provider\'s environment variables.');
    process.exit(1);
  }

  const ratelimitTest = await fetch(`https://discord.com/api/v10/invites/discord-developers`);

  if (!ratelimitTest.ok) {
    await question(`Uh oh, looks like the node you're on is currently being blocked by Discord. Press the "Enter" button on your keyboard to be reassigned to a new node. (you'll need to rerun the program once you reconnect)`)
    execSync('kill 1');
    return;
  };
  
  await client.login(token).catch((err) => {
    if (err.code === 'TokenInvalid') {
      console.error('❌ ERROR: Invalid Discord token provided!');
      console.error('Please check your config.env file and ensure the DISCORD_TOKEN is correct.');
      console.error('Common issues include extra spaces, missing characters, or using an old, invalidated token.');
      console.error('Your new token should be a long string of characters provided by the Discord Developer Portal.');
    } else {
      console.error('❌ An error occurred during login:', err.message);
    }
    process.exit(1);
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
  
  keepAlive();
})();

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