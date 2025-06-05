require('dotenv').config({ path: '../config.env' });
const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, getVoiceConnection, StreamType, demuxProbe } = require('@discordjs/voice');
const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

const {
  isSpotifyUrl,
  isUserAuthenticated,
  getUserCurrentPlayback,
  controlUserPlayback,
  getUserDevices,
  addToUserQueue
} = require('../media/spotifyUtils');
const { queues, getQueue } = require('../media/queueManager');
const {
    playSong
} = require('../media/streamManager');

const { getBestAudioSource } = require('../media/sourceFetcher');

const { aggregateMusicSearch } = require('../media/musicAggregator');
const { musicPageRank } = require('../media/musicPageRank');
const { 
    getCurrentPlaybackState, 
    getCurrentlyPlayingTrack,
    pausePlayback,
    resumePlayback,
    skipToNext,
    skipToPrevious,
    getAvailableDevices
} = require('../media/spotifyUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('🎵 Music commands with Spotify integration')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('🎵 Search and play music from multiple sources')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Song name, artist, or URL (Spotify, YouTube, SoundCloud)')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('spotify_queue')
            .setDescription('Add to your personal Spotify queue (requires /spotify login)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('current')
        .setDescription('🎵 Show what\'s currently playing (Discord bot or Spotify)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('⏸️ Pause current playback (Discord bot)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('▶️ Resume current playback (Discord bot)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('⏭️ Skip to next track (Discord bot)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('previous')
        .setDescription('⏮️ Go to previous track (Discord bot)'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('🔍 Search for songs and choose from multiple results')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Song name, artist, or keywords')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('spotify_queue')
            .setDescription('Add selected song to your Spotify queue instead')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stats')
        .setDescription('📊 View music popularity and ranking statistics')),
        
  async execute(interaction) {
    const { guildId, member, options, channel } = interaction;
    const queue = getQueue(guildId);
    queue.textChannel = channel;

    const subcommand = options.getSubcommand();
    const userId = interaction.user.id;
    const userHasSpotify = isUserAuthenticated(userId);

    if (!member.voice.channel && ['play', 'stop', 'skip', 'loop'].includes(subcommand)) {
      return interaction.reply({ 
        content: 'You need to be in a voice channel to use this music command!', 
        ephemeral: true 
      });
    }
    
    if (subcommand === 'queue') {
      await interaction.deferReply({ ephemeral: true });
      try {
        if (!queue.songs.length) {
          let queueMessage = 'The Discord queue is empty!';
          if (userHasSpotify) {
            queueMessage += '\n\n💡 **Tip:** You can also check your Spotify queue using `/spotify status`';
          } else {
            queueMessage += '\n\n💡 **Tip:** Use `/spotify login` to connect your account and access your personal Spotify queue!';
          }
          return interaction.editReply(queueMessage);
        }
        const current = queue.songs[0];
        const upcoming = queue.songs.slice(1);
        let queueString = `**Now Playing:** ${current.title} (${current.source})\n`;
        if (current.duration) queueString += `Duration: ${new Date(current.duration * 1000).toISOString().substr(11, 8)}\n`;
        if (current.webpageUrl) queueString += `Link: <${current.webpageUrl}>\n`;
        
        queueString += '\n**Up Next:**\n';
        if (upcoming.length === 0) {
          queueString += 'No songs in queue.';
        } else {
          queueString += upcoming.map((song, index) => `${index + 1}. ${song.title} (${song.source})`).join('\n');
        }
        
        if (userHasSpotify) {
          queueString += '\n\n💡 **Tip:** Use `/spotify status` to see your personal Spotify playback';
        } else {
          queueString += '\n\n💡 **Tip:** Use `/spotify login` to access enhanced Spotify features!';
        }
        
        return interaction.editReply(queueString);
      } catch (err) {
        console.error('Error in queue command:', err);
        if (!interaction.replied && !interaction.deferred) return interaction.reply({ content: 'Error displaying queue.', ephemeral: true }).catch(console.error);
        return interaction.editReply({ content: 'Error displaying queue.', ephemeral: true }).catch(console.error);
      }
    }

    if (!queue.connection && ['play'].includes(subcommand)) { 
        if (member.voice.channel) {
            console.log(`Joining voice channel ${member.voice.channel.id} in guild ${guildId}`);
            try {
                queue.connection = joinVoiceChannel({
                    channelId: member.voice.channel.id,
                    guildId: guildId,
                    adapterCreator: member.voice.channel.guild.voiceAdapterCreator,
                    selfDeaf: false,
                });
                queue.connection.subscribe(queue.player); 
                console.log('Voice connection established and player subscribed.');
            } catch (connectionError) {
                console.error("Error joining voice channel or subscribing player:", connectionError);
                return interaction.reply({ content: 'Could not join your voice channel.', ephemeral: true });
            }
        } else {
             return interaction.reply({ content: 'You must be in a voice channel to play music.', ephemeral: true });
        }
    }

    try {
      switch (subcommand) {
        case 'play':
          await handlePlay(interaction);
          break;
        case 'current':
          await handleCurrent(interaction);
          break;
        case 'pause':
          await handlePause(interaction);
          break;
        case 'resume':
          await handleResume(interaction);
          break;
        case 'skip':
          await handleSkip(interaction);
          break;
        case 'previous':
          await handlePrevious(interaction);
          break;
        case 'search':
          await handleSearch(interaction);
          break;
        case 'stats':
          await handleStats(interaction);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown music command.',
            ephemeral: true
          });
      }
    } catch (error) {
      console.error('Music command error:', error);
      const errorMessage = error.message || 'An unexpected error occurred';
      
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true
        });
      }
    }
  }
};

async function handlePlay(interaction) {
  const query = interaction.options.getString('query');
  const addToSpotifyQueue = interaction.options.getBoolean('spotify_queue') || false;
  const userId = interaction.user.id;
  const userHasSpotify = isUserAuthenticated(userId);
  
  await interaction.deferReply();
  
  console.log(`🎵 Music search request: "${query}" (${addToSpotifyQueue ? 'spotify queue' : 'discord play'})`);
  
  // Check if user wants to add to Spotify queue but isn't authenticated
  if (addToSpotifyQueue && !userHasSpotify) {
    return interaction.editReply({
      content: '🔐 **Authentication Required**\n\nTo add songs to your Spotify queue, you need to connect your account first.\n\n**Steps:**\n1. Use `/spotify login` to connect your account\n2. Complete the authentication process\n3. Try this command again with the `spotify_queue` option\n\n**Alternative:** Remove the `spotify_queue` option to play through Discord instead.\n\n📖 **Setup Guide:** Visit [our guide](https://gogesbot.workers.dev/spotify/guide) for step-by-step instructions.'
    });
  }
  
  try {
    // If adding to Spotify queue, handle that separately
    if (addToSpotifyQueue && userHasSpotify) {
      return await handleSpotifyQueueAdd(interaction, query, userId);
    }

    // Regular Discord playback
    const searchResults = await aggregateMusicSearch(query, {
      sources: ['spotify', 'soundcloud'],
      maxResults: 5,
      timeout: 15000
    });

    if (!searchResults || searchResults.length === 0 || searchResults[0].isError) {
      let errorMessage = '❌ No results found for your search.';
      if (!userHasSpotify) {
        errorMessage += '\n\n💡 **Tip:** Connect your Spotify account with `/spotify login` for access to enhanced features and your personal music!\n\n📖 **Setup Guide:** Visit [our guide](https://gogesbot.workers.dev/spotify/guide) for step-by-step instructions.';
      }
      return interaction.editReply(errorMessage);
    }

    if (searchResults.length > 1) {
      await showSearchResults(interaction, searchResults, query, addToSpotifyQueue);
      return;
    }
    
    const firstResult = searchResults[0];
    
    if (firstResult.isError) {
      await interaction.editReply({
        content: firstResult.errorMessage,
        ephemeral: true
      });
      return;
    }
    
    if (firstResult.canPlayDirectly) {
      let success = false;
      
      // Handle Spotify sources with URIs
      if (firstResult.spotifyUri) {
        if (addToSpotifyQueue) {
          success = await firstResult.addToSpotifyQueue();
          if (success) {
            const embed = new EmbedBuilder()
              .setColor(0x1DB954)
              .setTitle('✅ Added to Spotify Queue')
              .setDescription(`**${firstResult.title}**`)
              .addFields(
                { name: '🎵 Source', value: firstResult.source, inline: true },
                { name: '⏱️ Duration', value: firstResult.duration || formatDuration(firstResult.durationSeconds), inline: true }
              )
              .setThumbnail(firstResult.thumbnail)
              .setFooter({ text: 'Check your Spotify app to see the queue' });
            
            await interaction.editReply({ embeds: [embed] });
            return;
          }
        } else {
          success = await firstResult.playOnSpotify();
          if (success) {
            const embed = new EmbedBuilder()
              .setColor(0x1DB954)
              .setTitle('🎵 Now Playing on Spotify')
              .setDescription(`**${firstResult.title}**`)
              .addFields(
                { name: '🎵 Source', value: firstResult.source, inline: true },
                { name: '⏱️ Duration', value: firstResult.duration || formatDuration(firstResult.durationSeconds), inline: true }
              )
              .setThumbnail(firstResult.thumbnail)
              .setFooter({ text: 'Playing on your active Spotify device' });
            
            await interaction.editReply({ embeds: [embed] });
            return;
          }
        }
      }
      
      if (firstResult.webpageUrl && !success) {
        const { guildId, member } = interaction;
        const queue = getQueue(guildId);
        
        if (addToSpotifyQueue) {
          queue.songs.push({
            title: firstResult.title,
            webpageUrl: firstResult.webpageUrl,
            duration: firstResult.durationSeconds,
            thumbnail: firstResult.thumbnail,
            source: firstResult.source,
            requestedBy: member.user.tag
          });
          
          const embed = new EmbedBuilder()
            .setColor(0xFF6B35)
            .setTitle('✅ Added to Bot Queue')
            .setDescription(`**${firstResult.title}**`)
            .addFields(
              { name: '🎵 Source', value: firstResult.source, inline: true },
              { name: '⏱️ Duration', value: firstResult.duration || formatDuration(firstResult.durationSeconds), inline: true },
              { name: '📋 Queue Position', value: `${queue.songs.length}`, inline: true }
            )
            .setThumbnail(firstResult.thumbnail)
            .setFooter({ text: 'Added to Discord bot queue' });
          
          await interaction.editReply({ embeds: [embed] });
          return;
        } else {
          try {
            console.log(`🎵 Starting Discord playback for "${firstResult.title}"`);
            
            queue.songs.unshift({
              title: firstResult.title,
              webpageUrl: firstResult.webpageUrl,
              duration: firstResult.durationSeconds,
              thumbnail: firstResult.thumbnail,
              source: firstResult.source,
              requestedBy: member.user.tag
            });
            
            await playSong(guildId, queue.songs[0]);
            
            const embed = new EmbedBuilder()
              .setColor(0xFF6B35)
              .setTitle('🎵 Now Playing in Voice Channel')
              .setDescription(`**${firstResult.title}**`)
              .addFields(
                { name: '🎵 Source', value: firstResult.source, inline: true },
                { name: '⏱️ Duration', value: firstResult.duration || formatDuration(firstResult.durationSeconds), inline: true }
              )
              .setThumbnail(firstResult.thumbnail)
              .setFooter({ text: 'Playing in Discord voice channel' });
            
            await interaction.editReply({ embeds: [embed] });
            return;
          } catch (playError) {
            console.error('Discord playback failed:', playError);
            success = false;
          }
        }
      }
      
      if (!success) {
        await interaction.editReply({
          content: `❌ Failed to ${addToSpotifyQueue ? 'add to queue' : 'play'} "${firstResult.title}". ${firstResult.spotifyUri ? 'Make sure you have an active Spotify session.' : 'Streaming error occurred.'}`,
          ephemeral: true
        });
        return;
      }
    }
    
    const embed = new EmbedBuilder()
      .setColor(0xFF6B35)
      .setTitle('🎵 Music Search Results')
      .setDescription(`Results for "${query}":`)
      .setFooter({ text: 'Click to manually select a track' });
    
    searchResults.slice(0, 5).forEach((result, index) => {
      const statusIcon = result.spotifyUri ? '🎵' : '🔊';
      const playableText = result.spotifyUri ? 'Spotify' : 'Voice Channel';
      embed.addFields({
        name: `${statusIcon} ${index + 1}. ${result.title}`,
        value: `**Source:** ${result.source}\n**Duration:** ${result.duration || formatDuration(result.durationSeconds)}\n**Playable:** ${playableText}`,
        inline: false
      });
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Search error:', error);
    await interaction.editReply({
      content: `❌ Search failed: ${error.message}`,
      ephemeral: true
    });
  }
}

async function showSearchResults(interaction, searchResults, query, addToSpotifyQueue) {
  const options = searchResults.slice(0, 10).map((result, index) => {
    const statusIcon = result.spotifyUri ? '🎵' : '🔊';
    const sourceIcon = result.source === 'Spotify' ? '🎵' : 
                      result.source === 'SoundCloud' ? '🔊' : 
                      result.source === 'YouTube' ? '📺' : '🎶';
    
    return {
      label: result.title.length > 100 ? result.title.substring(0, 97) + '...' : result.title,
      description: `${sourceIcon} ${result.source} • ${result.duration || formatDuration(result.durationSeconds)}`,
      value: `song_${index}`,
      emoji: statusIcon
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('music_search_select')
    .setPlaceholder('🎵 Choose a song to play...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(0x1DB954)
    .setTitle('🎵 Search Results')
    .setDescription(`Found ${searchResults.length} results for **"${query}"**\n\nSelect a song to ${addToSpotifyQueue ? 'add to queue' : 'play'}:`)
    .setFooter({ text: 'Selection expires in 60 seconds' });

  searchResults.slice(0, 5).forEach((result, index) => {
    const statusIcon = result.spotifyUri ? '🎵' : '🔊';
    const playableText = result.spotifyUri ? 'Spotify' : 'Voice Channel';
    embed.addFields({
      name: `${statusIcon} ${index + 1}. ${result.title}`,
      value: `**Artist:** ${result.artist || 'Unknown'}\n**Source:** ${result.source}\n**Duration:** ${result.duration || formatDuration(result.durationSeconds)}\n**Plays on:** ${playableText}`,
      inline: true
    });
  });

  const response = await interaction.editReply({ 
    embeds: [embed], 
    components: [row] 
  });

  try {
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 60000,
      filter: (i) => i.user.id === interaction.user.id
    });

    collector.on('collect', async (selectInteraction) => {
      const selectedIndex = parseInt(selectInteraction.values[0].split('_')[1]);
      const selectedResult = searchResults[selectedIndex];

      await selectInteraction.deferUpdate();
      
      await playSelectedSong(interaction, selectedResult, addToSpotifyQueue);
      
      const selectedEmbed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('✅ Song Selected')
        .setDescription(`**${selectedResult.title}**`)
        .addFields(
          { name: '🎵 Source', value: selectedResult.source, inline: true },
          { name: '⏱️ Duration', value: selectedResult.duration || formatDuration(selectedResult.durationSeconds), inline: true },
          { name: '🎯 Action', value: addToSpotifyQueue ? 'Added to queue' : 'Now playing', inline: true }
        )
        .setThumbnail(selectedResult.thumbnail);

      await interaction.editReply({ 
        embeds: [selectedEmbed], 
        components: [] 
      });
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        const timeoutEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('⏰ Selection Timeout')
          .setDescription('Song selection timed out. Please try the command again.');

        await interaction.editReply({ 
          embeds: [timeoutEmbed], 
          components: [] 
        }).catch(console.error);
      }
    });

  } catch (error) {
    console.error('Error in song selection:', error);
    await interaction.editReply({
      content: '❌ Error setting up song selection. Please try again.',
      components: []
    }).catch(console.error);
  }
}

async function playSelectedSong(interaction, selectedResult, addToSpotifyQueue) {
  if (selectedResult.isError) {
    await interaction.followUp({
      content: selectedResult.errorMessage,
      ephemeral: true
    });
    return;
  }

  if (selectedResult.canPlayDirectly) {
    let success = false;
    
    if (selectedResult.spotifyUri) {
      if (addToSpotifyQueue) {
        success = await selectedResult.addToSpotifyQueue();
      } else {
        success = await selectedResult.playOnSpotify();
      }
    }
    
    // Handle streaming sources (SoundCloud, YouTube)
    if (selectedResult.webpageUrl && !success) {
      const { guildId, member } = interaction;
      const queue = getQueue(guildId);
      
      if (addToSpotifyQueue) {
        queue.songs.push({
          title: selectedResult.title,
          webpageUrl: selectedResult.webpageUrl,
          duration: selectedResult.durationSeconds,
          thumbnail: selectedResult.thumbnail,
          source: selectedResult.source,
          requestedBy: member.user.tag
        });
        success = true;
      } else {
        try {
          queue.songs.unshift({
            title: selectedResult.title,
            webpageUrl: selectedResult.webpageUrl,
            duration: selectedResult.durationSeconds,
            thumbnail: selectedResult.thumbnail,
            source: selectedResult.source,
            requestedBy: member.user.tag
          });
          
          await playSong(guildId, queue.songs[0]);
          success = true;
        } catch (playError) {
          console.error('Discord playback failed:', playError);
          success = false;
        }
      }
    }
    
    if (!success) {
      await interaction.followUp({
        content: `❌ Failed to ${addToSpotifyQueue ? 'add to queue' : 'play'} "${selectedResult.title}". ${selectedResult.spotifyUri ? 'Make sure you have an active Spotify session.' : 'Streaming error occurred.'}`,
        ephemeral: true
      });
    }
  }
}

async function handleSearch(interaction) {
  const query = interaction.options.getString('query');
  const addToSpotifyQueue = interaction.options.getBoolean('spotify_queue') || false;
  
  if (!interaction.member.voice.channel && !addToSpotifyQueue) {
    return interaction.reply({ 
      content: 'You need to be in a voice channel to play music! Use `spotify_queue: true` to add to Spotify queue instead.', 
      ephemeral: true 
    });
  }
  
  await interaction.deferReply();
  
  console.log(`🔍 Explicit search request: "${query}" (${addToSpotifyQueue ? 'spotify queue' : 'discord play'})`);
  
  try {
    const searchResults = await aggregateMusicSearch(query, {
      sources: ['spotify', 'soundcloud'],
      maxResults: 10,
      timeout: 20000
    });
    
    if (!searchResults || searchResults.length === 0) {
      await interaction.editReply({
        content: `❌ No results found for "${query}". Try different keywords or artist names.`,
        ephemeral: true
      });
      return;
    }

    await showSearchResults(interaction, searchResults, query, addToSpotifyQueue);
    
  } catch (error) {
    console.error('Search command error:', error);
    await interaction.editReply({
      content: `❌ Search failed: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleCurrent(interaction) {
  const userId = interaction.user.id;
  const userHasSpotify = isUserAuthenticated(userId);
  
  await interaction.deferReply({ ephemeral: true });

  try {
    const guildId = interaction.guildId;
    const queue = getQueue(guildId);
    
    let embed = {
      title: '🎵 Current Playback Status',
      color: 0x1DB954,
      fields: [],
      timestamp: new Date().toISOString()
    };

    if (queue.songs.length > 0 && queue.playing) {
      const currentSong = queue.songs[0];
      embed.fields.push({
        name: '🤖 Discord Bot - Now Playing',
        value: `**${currentSong.title}**\nSource: ${currentSong.source}`,
        inline: false
      });
    } else {
      embed.fields.push({
        name: '🤖 Discord Bot',
        value: 'Nothing currently playing',
        inline: false
      });
    }

    if (userHasSpotify) {
      try {
        const spotifyPlayback = await getUserCurrentPlayback(userId);
        
        if (spotifyPlayback && spotifyPlayback.is_playing) {
          const track = spotifyPlayback.item;
          const progress = Math.floor(spotifyPlayback.progress_ms / 1000);
          const duration = Math.floor(track.duration_ms / 1000);
          
          const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
          };

          embed.fields.push({
            name: '🎵 Your Spotify - Now Playing',
            value: `**${track.name}**\nby ${track.artists.map(a => a.name).join(', ')}\n⏱️ ${formatTime(progress)} / ${formatTime(duration)}\n📱 ${spotifyPlayback.device.name}`,
            inline: false
          });
          
          if (track.album.images[0]) {
            embed.thumbnail = { url: track.album.images[0].url };
          }
        } else {
          embed.fields.push({
            name: '🎵 Your Spotify',
            value: 'Nothing currently playing',
            inline: false
          });
        }
      } catch (spotifyError) {
        embed.fields.push({
          name: '🎵 Your Spotify',
          value: 'Could not retrieve Spotify status',
          inline: false
        });
      }
    } else {
      embed.fields.push({
        name: '🎵 Spotify Integration',
        value: 'Use `/spotify login` to connect your account and see your personal Spotify playback here!',
        inline: false
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in current command:', error);
    await interaction.editReply('❌ Error retrieving current playback status.');
  }
}

async function handlePause(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  
  await interaction.deferReply({ ephemeral: true });

  if (!queue.playing) {
    return interaction.editReply('⏸️ Nothing is currently playing in Discord!');
  }

  try {
    queue.player.pause();
    queue.playing = false;
    
    let message = '⏸️ **Discord Playback Paused**\n\nUse `/music resume` to continue.';
    
    const userId = interaction.user.id;
    if (isUserAuthenticated(userId)) {
      message += '\n\n💡 **Tip:** Use `/spotify control pause` to pause your personal Spotify playback.';
    }
    
    await interaction.editReply(message);
  } catch (error) {
    console.error('Error pausing playback:', error);
    await interaction.editReply('❌ Failed to pause playback.');
  }
}

async function handleResume(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  
  await interaction.deferReply({ ephemeral: true });

  if (queue.playing) {
    return interaction.editReply('▶️ Discord playback is already running!');
  }

  if (queue.songs.length === 0) {
    return interaction.editReply('❌ No songs in the Discord queue to resume.');
  }

  try {
    queue.player.unpause();
    queue.playing = true;
    
    let message = '▶️ **Discord Playback Resumed**';
    
    const userId = interaction.user.id;
    if (isUserAuthenticated(userId)) {
      message += '\n\n💡 **Tip:** Use `/spotify control play` to resume your personal Spotify playback.';
    }
    
    await interaction.editReply(message);
  } catch (error) {
    console.error('Error resuming playback:', error);
    await interaction.editReply('❌ Failed to resume playback.');
  }
}

async function handleSkip(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  
  await interaction.deferReply({ ephemeral: true });

  if (queue.songs.length === 0) {
    return interaction.editReply('❌ No songs in the Discord queue to skip.');
  }

  if (queue.songs.length === 1) {
    return interaction.editReply('❌ This is the last song in the Discord queue.');
  }

  try {
    const currentSong = queue.songs[0];
    queue.player.stop();
    
    let message = `⏭️ **Skipped:** ${currentSong.title}`;
    
    const userId = interaction.user.id;
    if (isUserAuthenticated(userId)) {
      message += '\n\n💡 **Tip:** Use `/spotify control next` to skip tracks on your personal Spotify.';
    }
    
    await interaction.editReply(message);
  } catch (error) {
    console.error('Error skipping track:', error);
    await interaction.editReply('❌ Failed to skip track.');
  }
}

async function handlePrevious(interaction) {
  const guildId = interaction.guildId;
  const queue = getQueue(guildId);
  
  await interaction.deferReply({ ephemeral: true });

  let message = '❌ **Previous Track Not Available**\n\nThe Discord bot queue doesn\'t support going to the previous track.';
  
  const userId = interaction.user.id;
  if (isUserAuthenticated(userId)) {
    message += '\n\n💡 **Spotify Alternative:** Use `/spotify control previous` to go back on your personal Spotify playback!';
  } else {
    message += '\n\n💡 **Tip:** Connect your Spotify account with `/spotify login` to get previous track functionality!';
  }
  
  await interaction.editReply(message);
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Unknown';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

async function handleSpotifyQueueAdd(interaction, query, userId) {
  try {
    // Search for the song
    const searchResults = await aggregateMusicSearch(query, {
      sources: ['spotify'],
      maxResults: 5,
      timeout: 10000
    });

    if (!searchResults || searchResults.length === 0 || searchResults[0].isError) {
      return interaction.editReply('❌ No Spotify results found for your search. Try a different search term.');
    }

    const firstResult = searchResults[0];
    
    if (!firstResult.spotifyUri) {
      return interaction.editReply('❌ Selected track is not available on Spotify. Please try a different song.');
    }

    // Extract track ID from URI
    const trackId = firstResult.spotifyUri.split(':')[2];
    const success = await addToUserQueue(userId, firstResult.spotifyUri);
    
    if (success) {
      const embed = {
        title: '✅ Added to Spotify Queue',
        description: `Successfully added **${firstResult.title}** to your Spotify queue!`,
        color: 0x1DB954,
        fields: [
          { name: '🎵 Song', value: firstResult.title, inline: false },
          { name: '🎧 Source', value: 'Spotify', inline: true },
          { name: '⏱️ Duration', value: firstResult.duration || 'Unknown', inline: true }
        ],
        thumbnail: { url: firstResult.thumbnail },
        footer: { text: 'The song will play after your current track finishes' }
      };
      
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.editReply('❌ Failed to add track to your Spotify queue. Make sure you have an active Spotify device and try again.');
    }
  } catch (error) {
    console.error('Error adding to Spotify queue:', error);
    let errorMessage = '❌ Failed to add to Spotify queue.\n\n';
    
    if (error.message.includes('NO_ACTIVE_DEVICE')) {
      errorMessage += 'No active Spotify device found. Please:\n• Open Spotify on any device\n• Start playing something\n• Try the command again';
    } else if (error.message.includes('PREMIUM_REQUIRED')) {
      errorMessage += 'Adding to queue requires Spotify Premium.';
    } else {
      errorMessage += `Error: ${error.message}`;
    }
    
    await interaction.editReply(errorMessage);
  }
}

async function handleStats(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  try {
    const stats = musicPageRank.getGraphStats();
    
    const embed = {
      title: '📊 Music Statistics & Rankings',
      description: 'Based on user listening patterns and song relationships',
      color: 0x9146FF,
      fields: [
        {
          name: '📈 Graph Overview',
          value: `• **Songs Tracked:** ${stats.songCount.toLocaleString()}\n• **Relationships:** ${stats.relationshipCount.toLocaleString()}\n• **Last Calculated:** ${stats.lastCalculated}`,
          inline: false
        }
      ],
      footer: {
        text: 'Rankings are updated hourly based on user interactions'
      },
      timestamp: new Date().toISOString()
    };
    
    if (stats.topSongs && stats.topSongs.length > 0) {
      const topSongsList = stats.topSongs
        .slice(0, 5)
        .map((song, index) => {
          const title = song.metadata?.title || song.songId.substring(0, 50);
          const score = parseFloat(song.score);
          const playCount = song.metadata?.playCount || 0;
          const searchCount = song.metadata?.searchCount || 0;
          
          return `**${index + 1}.** ${title}\n` +
                 `   • Score: ${score.toFixed(4)} | Plays: ${playCount} | Searches: ${searchCount}`;
        })
        .join('\n\n');
      
      embed.fields.push({
        name: '🏆 Top Ranked Songs',
        value: topSongsList || 'No data available',
        inline: false
      });
    }
    
    embed.fields.push({
      name: '🧠 How Rankings Work',
      value: '• Songs gain rank when played together in queues\n' +
             '• Playlist co-occurrence builds relationships\n' +
             '• Search patterns influence scoring\n' +
             '• Popular songs boost related tracks\n' +
             '• Based on Google\'s PageRank algorithm',
      inline: false
    });
    
    if (stats.songCount < 50) {
      embed.fields.push({
        name: '💡 Building Better Rankings',
        value: 'Keep using the music bot! More interactions = better recommendations.',
        inline: false
      });
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Error in stats command:', error);
    await interaction.editReply('❌ Error retrieving music statistics.');
  }
}
