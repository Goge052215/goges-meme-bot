const { SlashCommandBuilder } = require('discord.js');
const { 
    generateAuthUrl, 
    isUserAuthenticated, 
    revokeUserAuth,
    getUserCurrentPlayback,
    controlUserPlayback,
    getUserDevices,
    getUserPlaylists,
    addToUserQueue,
    getSpotifyTrackId,
    isSpotifyUrl
} = require('../media/spotifyUtils');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Enhanced Spotify integration with OAuth')
        .addSubcommand(subcommand =>
            subcommand
                .setName('login')
                .setDescription('Connect your Spotify account for enhanced features'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('logout')
                .setDescription('Disconnect your Spotify account'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your Spotify connection and current playback'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('control')
                .setDescription('Control your Spotify playback')
                .addStringOption(option =>
                    option
                        .setName('action')
                        .setDescription('Playback action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Play', value: 'play' },
                            { name: 'Pause', value: 'pause' },
                            { name: 'Next Track', value: 'next' },
                            { name: 'Previous Track', value: 'previous' },
                            { name: 'Toggle Shuffle', value: 'shuffle' }
                        ))
                .addIntegerOption(option =>
                    option
                        .setName('volume')
                        .setDescription('Set volume (0-100)')
                        .setMinValue(0)
                        .setMaxValue(100)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('devices')
                .setDescription('List your available Spotify devices'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('playlists')
                .setDescription('List your Spotify playlists')
                .addIntegerOption(option =>
                    option
                        .setName('limit')
                        .setDescription('Number of playlists to show (default: 10)')
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('Add a song to your Spotify queue')
                .addStringOption(option =>
                    option
                        .setName('song')
                        .setDescription('Song name or Spotify URL to add to queue')
                        .setRequired(true))),

    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        try {
            switch (subcommand) {
                case 'login':
                    await handleLogin(interaction, userId);
                    break;
                case 'logout':
                    await handleLogout(interaction, userId);
                    break;
                case 'status':
                    await handleStatus(interaction, userId);
                    break;
                case 'control':
                    await handleControl(interaction, userId);
                    break;
                case 'devices':
                    await handleDevices(interaction, userId);
                    break;
                case 'playlists':
                    await handlePlaylists(interaction, userId);
                    break;
                case 'queue':
                    await handleQueue(interaction, userId);
                    break;
                default:
                    await interaction.reply({ 
                        content: '❌ Unknown subcommand.', 
                        ephemeral: true 
                    });
            }
        } catch (error) {
            console.error(`Error in spotify command (${subcommand}):`, error);
            
            const errorMessage = error.message.includes('User not authenticated')
                ? '🔐 **Authentication Required**\n\nYou need to connect your Spotify account first. Use `/spotify login` to get started!\n\n🌐 **Need Help?** Visit our [Setup Guide](https://gogesbot.workers.dev/spotify/guide) for step-by-step instructions.'
                : `❌ **Error:** ${error.message}\n\n🆘 **Troubleshooting:** Check our [Help Page](https://gogesbot.workers.dev/spotify/help) for common solutions.`;
            
            const replyOptions = { content: errorMessage, ephemeral: true };
            
            try {
                if (interaction.deferred) {
                    await interaction.editReply(replyOptions);
                } else if (!interaction.replied) {
                    await interaction.reply(replyOptions);
                } else {
                    await interaction.followUp(replyOptions);
                }
            } catch (replyError) {
                console.error('Error sending error message:', replyError);
            }
        }
    }
};

async function handleLogin(interaction, userId) {
    if (isUserAuthenticated(userId)) {
        await interaction.reply({
            content: '✅ **Already Connected**\n\nYour Spotify account is already connected! Use `/spotify status` to see your current playback.',
            ephemeral: true
        });
        return;
    }

    try {
        const { authUrl, state } = generateAuthUrl(userId);
        
        const embed = {
            title: '🎵 Connect Your Spotify Account',
            description: 'Click the link below to connect your Spotify account and unlock enhanced features!',
            color: 0x1DB954,
            fields: [
                {
                    name: '🔗 Authentication Link',
                    value: `[Click here to connect to Spotify](${authUrl})`,
                    inline: false
                },
                {
                    name: '✨ What you\'ll get:',
                    value: [
                        '• Control playback from Discord',
                        '• Access your personal playlists',
                        '• Add songs to your Spotify queue',
                        '• Manage devices and volume',
                        '• View current playing track'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '📝 Instructions:',
                    value: [
                        '1. Click the authentication link above',
                        '2. Log in to Spotify and grant permissions',
                        '3. Return here and use `/spotify status` to verify',
                        '4. Start using enhanced Spotify features!'
                    ].join('\n'),
                    inline: false
                },
                {
                    name: '🌐 Need Help?',
                    value: 'Visit our [Setup Guide](https://gogesbot.workers.dev/spotify/guide) or [Troubleshooting](https://gogesbot.workers.dev/spotify/help) page for detailed instructions.',
                    inline: false
                }
            ],
            footer: {
                text: 'Your authentication session will expire in 10 minutes if not completed.'
            },
            timestamp: new Date().toISOString()
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Error generating Spotify auth URL:', error);
        await interaction.reply({
            content: '❌ **Authentication Error**\n\nFailed to generate authentication link. Please try again later.',
            ephemeral: true
        });
    }
}

async function handleLogout(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        await interaction.reply({
            content: '🔓 **Not Connected**\n\nYou don\'t have a Spotify account connected. Use `/spotify login` to connect one!\n\n📖 **Setup Guide:** Visit [our guide](https://gogesbot.workers.dev/spotify/guide) for detailed instructions.',
            ephemeral: true
        });
        return;
    }

    const revoked = revokeUserAuth(userId);
    
    if (revoked) {
        await interaction.reply({
            content: '✅ **Disconnected Successfully**\n\nYour Spotify account has been disconnected. Use `/spotify login` to reconnect anytime!',
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: '❌ **Disconnect Failed**\n\nCould not disconnect your Spotify account. Please try again.',
            ephemeral: true
        });
    }
}

async function handleStatus(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        await interaction.reply({
            content: '🔓 **Not Connected**\n\nYou don\'t have a Spotify account connected. Use `/spotify login` to get started!\n\n📖 **Setup Guide:** Visit [our guide](https://gogesbot.workers.dev/spotify/guide) for detailed instructions.',
            ephemeral: true
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const playbackState = await getUserCurrentPlayback(userId);
        
        if (!playbackState || !playbackState.is_playing) {
            await interaction.editReply({
                content: '🔐 **Spotify Connected** ✅\n\n⏸️ **Status:** Not currently playing\n\nUse `/spotify control play` to start playing or `/spotify devices` to see available devices.'
            });
            return;
        }

        const track = playbackState.item;
        const device = playbackState.device;
        const progress = Math.floor(playbackState.progress_ms / 1000);
        const duration = Math.floor(track.duration_ms / 1000);
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        const embed = {
            title: '🎵 Spotify Status',
            color: 0x1DB954,
            fields: [
                {
                    name: '🎵 Currently Playing',
                    value: `**${track.name}**\nby ${track.artists.map(a => a.name).join(', ')}`,
                    inline: false
                },
                {
                    name: '💿 Album',
                    value: track.album.name,
                    inline: true
                },
                {
                    name: '⏱️ Progress',
                    value: `${formatTime(progress)} / ${formatTime(duration)}`,
                    inline: true
                },
                {
                    name: '📱 Device',
                    value: `${device.name} (${device.type})`,
                    inline: true
                },
                {
                    name: '🔊 Volume',
                    value: `${device.volume_percent}%`,
                    inline: true
                },
                {
                    name: '🔀 Shuffle',
                    value: playbackState.shuffle_state ? 'On' : 'Off',
                    inline: true
                },
                {
                    name: '🔁 Repeat',
                    value: playbackState.repeat_state === 'off' ? 'Off' : 
                           playbackState.repeat_state === 'track' ? 'Track' : 'Context',
                    inline: true
                }
            ],
            thumbnail: {
                url: track.album.images[0]?.url
            },
            footer: {
                text: `Use /spotify control to manage playback`
            },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting Spotify status:', error);
        await interaction.editReply({
            content: '❌ **Status Error**\n\nCould not retrieve your Spotify status. Make sure Spotify is open and you have an active device.'
        });
    }
}

async function handleControl(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        throw new Error('User not authenticated');
    }

    const action = interaction.options.getString('action');
    const volume = interaction.options.getInteger('volume');

    await interaction.deferReply({ ephemeral: true });

    try {
        const params = {};
        if (volume !== null && action === 'play') {
            params.volume = volume;
        }

        if (action === 'shuffle') {
            // Toggle shuffle - first get current state
            const currentState = await getUserCurrentPlayback(userId);
            params.state = !currentState?.shuffle_state;
            await controlUserPlayback(userId, 'shuffle', params);
        } else if (volume !== null && (action === 'play' || action === 'pause')) {
            // Set volume first, then perform action
            await controlUserPlayback(userId, 'volume', { volume });
            if (action !== 'play') { // Don't double-play
                await controlUserPlayback(userId, action, params);
            }
        } else {
            await controlUserPlayback(userId, action, params);
        }

        const actionMessages = {
            play: '▶️ **Playback Resumed**',
            pause: '⏸️ **Playback Paused**',
            next: '⏭️ **Skipped to Next Track**',
            previous: '⏮️ **Skipped to Previous Track**',
            shuffle: '🔀 **Shuffle Toggled**',
            volume: `🔊 **Volume Set to ${volume}%**`
        };

        let message = actionMessages[action] || `✅ **${action} executed**`;
        if (volume !== null && action !== 'volume') {
            message += `\n🔊 Volume set to ${volume}%`;
        }

        await interaction.editReply({ content: message });
    } catch (error) {
        console.error('Error controlling Spotify playback:', error);
        let errorMessage = '❌ **Playback Control Failed**\n\n';
        
        if (error.message.includes('NO_ACTIVE_DEVICE')) {
            errorMessage += 'No active Spotify device found. Please:\n• Open Spotify on any device\n• Start playing something\n• Try the command again\n\n🆘 **Need Help?** Check our [troubleshooting guide](https://gogesbot.workers.dev/spotify/help) for device setup.';
        } else if (error.message.includes('PREMIUM_REQUIRED')) {
            errorMessage += 'This feature requires Spotify Premium.\n\n💡 **Tip:** Visit our [help page](https://gogesbot.workers.dev/spotify/help) to see which features work with free accounts.';
        } else {
            errorMessage += `Error: ${error.message}\n\n🆘 **Troubleshooting:** Visit our [help page](https://gogesbot.workers.dev/spotify/help) for solutions.`;
        }

        await interaction.editReply({ content: errorMessage });
    }
}

async function handleDevices(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        throw new Error('User not authenticated');
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const devices = await getUserDevices(userId);
        
        if (!devices || devices.length === 0) {
            await interaction.editReply({
                content: '📱 **No Devices Found**\n\nNo Spotify devices are currently available. Please:\n• Open Spotify on your phone, computer, or other device\n• Make sure you\'re logged into the same account\n• Try again'
            });
            return;
        }

        const deviceList = devices.map(device => {
            const status = device.is_active ? '🟢' : '⚪';
            const volume = device.volume_percent !== null ? ` (${device.volume_percent}%)` : '';
            return `${status} **${device.name}** - ${device.type}${volume}`;
        }).join('\n');

        const embed = {
            title: '📱 Your Spotify Devices',
            description: deviceList,
            color: 0x1DB954,
            fields: [
                {
                    name: 'Legend',
                    value: '🟢 Currently Active\n⚪ Available',
                    inline: false
                }
            ],
            footer: {
                text: `Found ${devices.length} device${devices.length !== 1 ? 's' : ''}`
            },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting Spotify devices:', error);
        await interaction.editReply({
            content: '❌ **Device Error**\n\nCould not retrieve your Spotify devices. Please try again later.'
        });
    }
}

async function handlePlaylists(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        throw new Error('User not authenticated');
    }

    const limit = interaction.options.getInteger('limit') || 10;
    await interaction.deferReply({ ephemeral: true });

    try {
        const playlists = await getUserPlaylists(userId, { limit });
        
        if (!playlists || playlists.length === 0) {
            await interaction.editReply({
                content: '📝 **No Playlists Found**\n\nYou don\'t have any playlists, or they\'re not accessible. Try creating some playlists in Spotify first!'
            });
            return;
        }

        const playlistList = playlists.map((playlist, index) => {
            const trackCount = playlist.tracks?.total || 0;
            const isPublic = playlist.public ? '🌐' : '🔒';
            return `${index + 1}. ${isPublic} **${playlist.name}** (${trackCount} tracks)`;
        }).join('\n');

        const embed = {
            title: '📝 Your Spotify Playlists',
            description: playlistList,
            color: 0x1DB954,
            fields: [
                {
                    name: 'Legend',
                    value: '🌐 Public Playlist\n🔒 Private Playlist',
                    inline: false
                }
            ],
            footer: {
                text: `Showing ${playlists.length} of your playlists`
            },
            timestamp: new Date().toISOString()
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error getting Spotify playlists:', error);
        await interaction.editReply({
            content: '❌ **Playlist Error**\n\nCould not retrieve your playlists. Please try again later.'
        });
    }
}

async function handleQueue(interaction, userId) {
    if (!isUserAuthenticated(userId)) {
        throw new Error('User not authenticated');
    }

    const songInput = interaction.options.getString('song');
    await interaction.deferReply({ ephemeral: true });

    try {
        let trackUri = null;
        
        if (isSpotifyUrl(songInput)) {
            // Extract track ID from Spotify URL
            const trackId = getSpotifyTrackId(songInput);
            if (trackId) {
                trackUri = `spotify:track:${trackId}`;
            } else {
                throw new Error('Invalid Spotify URL format');
            }
        } else {
            // For now, we'll need the user to provide a Spotify URL
            // In the future, we could search and let them select
            throw new Error('Please provide a Spotify track URL. Song search coming soon!');
        }

        await addToUserQueue(userId, trackUri);
        
        await interaction.editReply({
            content: `✅ **Added to Queue**\n\n🎵 Successfully added the track to your Spotify queue!\n\nThe song will play after your current track or playlist finishes.`
        });
    } catch (error) {
        console.error('Error adding to Spotify queue:', error);
        let errorMessage = '❌ **Queue Error**\n\n';
        
        if (error.message.includes('NO_ACTIVE_DEVICE')) {
            errorMessage += 'No active Spotify device found. Please start playing something on Spotify first.';
        } else if (error.message.includes('PREMIUM_REQUIRED')) {
            errorMessage += 'Adding to queue requires Spotify Premium.';
        } else if (error.message.includes('Invalid Spotify URL')) {
            errorMessage += 'Please provide a valid Spotify track URL (e.g., https://open.spotify.com/track/...).';
        } else {
            errorMessage += error.message;
        }

        await interaction.editReply({ content: errorMessage });
    }
} 