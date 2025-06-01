require('dotenv').config({ path: '../config.env' });
const { SlashCommandBuilder, EmbedBuilder } = require('@discordjs/builders');
const { joinVoiceChannel, getVoiceConnection, StreamType, demuxProbe } = require('@discordjs/voice');
const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');

const {
  isSpotifyUrl,
} = require('../media/spotifyUtils');
const { queues, getQueue } = require('../media/queueManager');
const {
    playSong
} = require('../media/streamManager');

const { getBestAudioSource } = require('../media/sourceFetcher');

const { aggregateMusicSearch } = require('../media/musicAggregator');
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
    .setDescription('🎵 Spotify-focused music commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('🎵 Search and play music on Spotify or add to queue')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Song name, artist, or Spotify URL')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('queue')
            .setDescription('Add to Spotify queue instead of playing immediately')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('current')
        .setDescription('🎵 Show what\'s currently playing on Spotify'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('⏸️ Pause Spotify playback'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('▶️ Resume Spotify playback'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('⏭️ Skip to next track on Spotify'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('previous')
        .setDescription('⏮️ Go to previous track on Spotify'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('devices')
        .setDescription('📱 Show available Spotify devices'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('search')
        .setDescription('🔍 Search for songs and choose from multiple results')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('Song name, artist, or keywords')
            .setRequired(true))
        .addBooleanOption(option =>
          option.setName('queue')
            .setDescription('Add selected song to queue instead of playing immediately')
            .setRequired(false))),
        
  async execute(interaction) {
    const { guildId, member, options, channel } = interaction;
    const queue = getQueue(guildId);
    queue.textChannel = channel;

    const subcommand = options.getSubcommand();

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
          return interaction.editReply('The queue is empty!');
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
        case 'devices':
          await handleDevices(interaction);
          break;
        case 'search':
          await handleSearch(interaction);
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
  const addToQueue = interaction.options.getBoolean('queue') || false;
  
  await interaction.deferReply();
  
  console.log(`🎵 Music search request: "${query}" (${addToQueue ? 'queue' : 'play'})`);
  
  try {
    const searchResults = await aggregateMusicSearch(query, {
      maxResults: 5,
      sourceTimeout: 20000
    });
    
    if (!searchResults || searchResults.length === 0) {
      await interaction.editReply({
        content: `❌ No results found for "${query}". Try a different search term.`,
        ephemeral: true
      });
      return;
    }

    if (searchResults.length > 1) {
      await showSearchResults(interaction, searchResults, query, addToQueue);
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
        if (addToQueue) {
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
        
        if (addToQueue) {
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
          content: `❌ Failed to ${addToQueue ? 'add to queue' : 'play'} "${firstResult.title}". ${firstResult.spotifyUri ? 'Make sure you have an active Spotify session.' : 'Streaming error occurred.'}`,
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

async function showSearchResults(interaction, searchResults, query, addToQueue) {
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
    .setDescription(`Found ${searchResults.length} results for **"${query}"**\n\nSelect a song to ${addToQueue ? 'add to queue' : 'play'}:`)
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
      
      await playSelectedSong(interaction, selectedResult, addToQueue);
      
      const selectedEmbed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('✅ Song Selected')
        .setDescription(`**${selectedResult.title}**`)
        .addFields(
          { name: '🎵 Source', value: selectedResult.source, inline: true },
          { name: '⏱️ Duration', value: selectedResult.duration || formatDuration(selectedResult.durationSeconds), inline: true },
          { name: '🎯 Action', value: addToQueue ? 'Added to queue' : 'Now playing', inline: true }
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

async function playSelectedSong(interaction, selectedResult, addToQueue) {
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
      if (addToQueue) {
        success = await selectedResult.addToSpotifyQueue();
      } else {
        success = await selectedResult.playOnSpotify();
      }
    }
    
    // Handle streaming sources (SoundCloud, YouTube)
    if (selectedResult.webpageUrl && !success) {
      const { guildId, member } = interaction;
      const queue = getQueue(guildId);
      
      if (addToQueue) {
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
        content: `❌ Failed to ${addToQueue ? 'add to queue' : 'play'} "${selectedResult.title}". ${selectedResult.spotifyUri ? 'Make sure you have an active Spotify session.' : 'Streaming error occurred.'}`,
        ephemeral: true
      });
    }
  }
}

async function handleSearch(interaction) {
  const query = interaction.options.getString('query');
  const addToQueue = interaction.options.getBoolean('queue') || false;
  
  if (!interaction.member.voice.channel && !addToQueue) {
    return interaction.reply({ 
      content: 'You need to be in a voice channel to play music! Use `queue: true` to add to Spotify queue instead.', 
      ephemeral: true 
    });
  }
  
  await interaction.deferReply();
  
  console.log(`🔍 Explicit search request: "${query}" (${addToQueue ? 'queue' : 'play'})`);
  
  try {
    const searchResults = await aggregateMusicSearch(query, {
      maxResults: 10,
      sourceTimeout: 20000
    });
    
    if (!searchResults || searchResults.length === 0) {
      await interaction.editReply({
        content: `❌ No results found for "${query}". Try different keywords or artist names.`,
        ephemeral: true
      });
      return;
    }

    // Always show selection menu for search command
    await showSearchResults(interaction, searchResults, query, addToQueue);
    
  } catch (error) {
    console.error('Search command error:', error);
    await interaction.editReply({
      content: `❌ Search failed: ${error.message}`,
      ephemeral: true
    });
  }
}

async function handleCurrent(interaction) {
  await interaction.deferReply();
  
  try {
    const currentTrack = await getCurrentlyPlayingTrack();
    
    if (!currentTrack) {
      await interaction.editReply({
        content: '📱 No track currently playing on Spotify. Start playing music to see current track info.',
        ephemeral: true
      });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle(currentTrack.is_playing ? '🎵 Currently Playing' : '⏸️ Paused')
      .setDescription(`**${currentTrack.name}**\nby ${currentTrack.artists}`)
      .addFields(
        { name: '💽 Album', value: currentTrack.album, inline: true },
        { name: '⏱️ Progress', value: `${formatDuration(Math.floor(currentTrack.progress_ms / 1000))} / ${formatDuration(Math.floor(currentTrack.duration_ms / 1000))}`, inline: true },
        { name: '🎵 Source', value: 'Spotify', inline: true }
      )
      .setThumbnail(currentTrack.image)
      .setFooter({ text: 'Live from your Spotify account' });
    
    if (currentTrack.spotify_url) {
      embed.setURL(currentTrack.spotify_url);
    }
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Current track error:', error);
    await interaction.editReply({
      content: '❌ Failed to get current track information. Make sure you have an active Spotify session.',
      ephemeral: true
    });
  }
}

/**
 * Handle pause command
 */
async function handlePause(interaction) {
  try {
    const success = await pausePlayback();
    
    if (success) {
      await interaction.reply({
        content: '⏸️ Spotify playback paused.',
        ephemeral: false
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to pause playback. Make sure you have an active Spotify session.',
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: '❌ Error pausing playback. Check your Spotify connection.',
      ephemeral: true
    });
  }
}

async function handleResume(interaction) {
  try {
    const success = await resumePlayback();
    
    if (success) {
      await interaction.reply({
        content: '▶️ Spotify playback resumed.',
        ephemeral: false
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to resume playback. Make sure you have an active Spotify session.',
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: '❌ Error resuming playback. Check your Spotify connection.',
      ephemeral: true
    });
  }
}

async function handleSkip(interaction) {
  try {
    const success = await skipToNext();
    
    if (success) {
      await interaction.reply({
        content: '⏭️ Skipped to next track on Spotify.',
        ephemeral: false
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to skip track. Make sure you have an active Spotify session.',
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: '❌ Error skipping track. Check your Spotify connection.',
      ephemeral: true
    });
  }
}

async function handlePrevious(interaction) {
  try {
    const success = await skipToPrevious();
    
    if (success) {
      await interaction.reply({
        content: '⏮️ Went to previous track on Spotify.',
        ephemeral: false
      });
    } else {
      await interaction.reply({
        content: '❌ Failed to go to previous track. Make sure you have an active Spotify session.',
        ephemeral: true
      });
    }
  } catch (error) {
    await interaction.reply({
      content: '❌ Error going to previous track. Check your Spotify connection.',
      ephemeral: true
    });
  }
}

/**
 * Handle devices command
 */
async function handleDevices(interaction) {
  await interaction.deferReply();
  
  try {
    const devices = await getAvailableDevices();
    
    if (!devices || devices.length === 0) {
      await interaction.editReply({
        content: '📱 No Spotify devices found. Open Spotify on a device to see it here.',
        ephemeral: true
      });
      return;
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setTitle('📱 Available Spotify Devices')
      .setDescription('Your connected Spotify devices:')
      .setFooter({ text: `Found ${devices.length} device(s)` });
    
    devices.forEach(device => {
      const statusIcon = device.is_active ? '🟢' : '⚪';
      const deviceInfo = `**Type:** ${device.type}\n**Volume:** ${device.volume_percent}%\n**Status:** ${device.is_active ? 'Active' : 'Available'}`;
      
      embed.addFields({
        name: `${statusIcon} ${device.name}`,
        value: deviceInfo,
        inline: true
      });
    });
    
    await interaction.editReply({ embeds: [embed] });
    
  } catch (error) {
    console.error('Devices error:', error);
    await interaction.editReply({
      content: '❌ Failed to get device list. Make sure you have an active Spotify session.',
      ephemeral: true
    });
  }
}

/**
 * Format duration from seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return 'Unknown';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
