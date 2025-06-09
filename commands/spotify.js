const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { 
    isUserAuthenticated: workerIsUserAuthenticated,
    revokeUserToken: workerRevokeUserToken,
    getUserToken
} = require('../worker-kv-interface');
const spotifyUtils = require('../media/spotifyUtils');

// Use local spotifyUtils for all authentication operations
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
    isSpotifyUrl,
    getAuthStatus
} = spotifyUtils;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('spotify')
        .setDescription('Spotify integration commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('login')
                .setDescription('Connect your Spotify account to the bot'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('logout')
                .setDescription('Disconnect your Spotify account from the bot'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your Spotify connection status and current playback'))
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
                            { name: 'Skip to Next', value: 'next' },
                            { name: 'Skip to Previous', value: 'previous' },
                            { name: 'Toggle Shuffle', value: 'shuffle' }
                        ))
                .addIntegerOption(option =>
                    option
                        .setName('volume')
                        .setDescription('Set volume (0-100)')
                        .setMinValue(0)
                        .setMaxValue(100))
                .addStringOption(option =>
                    option
                        .setName('device')
                        .setDescription('Device ID to control (leave empty for current device)')
                )
                .addBooleanOption(option =>
                    option
                        .setName('shuffle_state')
                        .setDescription('Shuffle state (on/off)')
                ))
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
                        .setMaxValue(25))
                .addIntegerOption(option =>
                    option
                        .setName('offset')
                        .setDescription('Offset for pagination')
                        .setMinValue(0)
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('Add a song to your Spotify queue')
                .addStringOption(option =>
                    option
                        .setName('song')
                        .setDescription('Song name or Spotify URL')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('device')
                        .setDescription('Device ID to use (leave empty for current device)')
                ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('debug')
                .setDescription('Debug authentication status')),

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
                case 'debug':
                    await handleDebug(interaction, userId);
                    break;
                default:
                    await interaction.reply({ 
                        content: '❌ Unknown subcommand.', 
                        flags: MessageFlags.Ephemeral 
                    });
            }
        } catch (error) {
            console.error(`Error in spotify command (${subcommand}):`, error);
            
            const errorMessage = error.message.includes('User not authenticated')
                ? '🔐 **Authentication Required**\n\nYou need to connect your Spotify account first. Use `/spotify login` to get started!\n\n🌐 **Need Help?** Visit our [Setup Guide](https://gogesmemebot.gogebot.art/spotify/guide) for step-by-step instructions.'
                : `❌ **Error:** ${error.message}\n\n🆘 **Troubleshooting:** Check our [Help Page](https://gogesmemebot.gogebot.art/spotify/help) for common solutions.`;
            
            const replyOptions = { content: errorMessage, flags: MessageFlags.Ephemeral };
            
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
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        
        // Check if user is already authenticated using BOTH systems
        const localAuth = isUserAuthenticated(userId);
        const workerAuth = await workerIsUserAuthenticated(userId);
        
        if (localAuth || workerAuth) {
            return interaction.editReply({
                content: '🔓 **Already Connected**\n\nYour Spotify account is already connected! You can use all Spotify features.\n\nTo reconnect, first use `/spotify logout` and then try logging in again.',
                flags: MessageFlags.Ephemeral
            });
        }
        
        // Generate authentication URL with fallback support
        try {
            // Use getAuthorizationUrl with fallback support instead of direct API call
            const authUrl = await spotifyUtils.getAuthorizationUrl(
                userId, 
                [
                    'user-read-playback-state',
                    'user-modify-playback-state',
                    'user-read-currently-playing',
                    'playlist-read-private',
                    'playlist-read-collaborative',
                    'playlist-modify-public',
                    'playlist-modify-private',
                    'user-library-read',
                    'user-library-modify',
                    'user-read-private',
                    'user-read-email'
                ]
            );
            
            const embed = new EmbedBuilder()
                .setColor('#1DB954')
                .setTitle('Connect Your Spotify Account')
                .setDescription('Click the button below to authorize access to your Spotify account. This will open a secure Spotify login page.')
                .addFields(
                    {
                        name: '🔐 What permissions will be granted?',
                        value: '• See your account details\n• View and control playback\n• Access your playlists\n• Add songs to your library',
                        inline: false
                    },
                    {
                        name: '🔒 Is it secure?',
                        value: 'Yes! We use official Spotify OAuth. Your credentials are never shared with our bot.',
                        inline: false
                    },
                    {
                        name: '🌐 Need Help?',
                        value: 'Visit our [Setup Guide](https://gogesmemebot.gogebot.art/spotify/guide) or [Troubleshooting](https://gogesmemebot.gogebot.art/spotify/help) page for detailed instructions.',
                        inline: false
                    }
                )
                .setTimestamp()
                .setFooter({ text: 'Spotify Authentication', iconURL: 'https://i.imgur.com/EpqijHC.png' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Login with Spotify')
                        .setStyle(ButtonStyle.Link)
                        .setURL(authUrl)
                        .setEmoji('🔗')
                );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            console.error('[SpotifyCommand] Failed to generate auth URL:', error.message);
            
            // If both primary and fallback domains fail, provide information about direct Discord login
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('❌ Authentication Error')
                .setDescription('Unable to generate login URL.')
                .addFields({
                    name: '🔄 Try again later',
                    value: 'Our authentication service is temporarily unavailable. Please try again in a few minutes.',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: 'Error Code: AUTH_TEMP_UNAVAILABLE' });
                
            await interaction.editReply({
                embeds: [errorEmbed],
                flags: MessageFlags.Ephemeral
            });
        }
    } catch (error) {
        console.error('[SpotifyCommand] Login error:', error);
        
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `❌ **Error:** ${error.message}`,
                flags: MessageFlags.Ephemeral
            });
        } else {
            await interaction.editReply({
                content: `❌ **Error:** ${error.message}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }
}

async function handleLogout(interaction, userId) {
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        await interaction.reply({
            content: '🔓 **Not Connected**\n\nYou don\'t have a Spotify account connected. Use `/spotify login` to connect one!\n\n📖 **Setup Guide:** Visit [our guide](https://gogesmemebot.gogebot.art/spotify/guide) for detailed instructions.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    // Revoke from both systems
    const localRevoked = revokeUserAuth(userId);
    const workerRevoked = await workerRevokeUserToken(userId);
    
    if (localRevoked || workerRevoked) {
        await interaction.reply({
            content: '✅ **Disconnected Successfully**\n\nYour Spotify account has been disconnected. Use `/spotify login` to reconnect anytime!',
            flags: MessageFlags.Ephemeral
        });
    } else {
        await interaction.reply({
            content: '❌ **Disconnect Failed**\n\nCould not disconnect your Spotify account. Please try again.',
            flags: MessageFlags.Ephemeral
        });
    }
}

async function handleStatus(interaction, userId) {
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        await interaction.reply({
            content: '🔓 **Not Connected**\n\nYou don\'t have a Spotify account connected. Use `/spotify login` to get started!\n\n📖 **Setup Guide:** Visit [our guide](https://gogesmemebot.gogebot.art/spotify/guide) for detailed instructions.',
            flags: MessageFlags.Ephemeral
        });
        return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        throw new Error('User not authenticated');
    }

    const action = interaction.options.getString('action');
    const volume = interaction.options.getInteger('volume');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        const params = {};
        if (volume !== null && action === 'play') {
            params.volume = volume;
        }

        if (action === 'shuffle') {
            const currentState = await getUserCurrentPlayback(userId);
            params.state = !currentState?.shuffle_state;
            await controlUserPlayback(userId, 'shuffle', params);
        } else if (volume !== null && (action === 'play' || action === 'pause')) {
            await controlUserPlayback(userId, 'volume', { volume });
            if (action !== 'play') { 
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
            errorMessage += 'No active Spotify device found. Please:\n• Open Spotify on any device\n• Start playing something\n• Try the command again\n\n🆘 **Need Help?** Check our [troubleshooting guide](https://gogesmemebot.gogebot.art/spotify/help) for device setup.';
        } else if (error.message.includes('PREMIUM_REQUIRED')) {
            errorMessage += 'This feature requires Spotify Premium.\n\n💡 **Tip:** Visit our [help page](https://gogesmemebot.gogebot.art/spotify/help) to see which features work with free accounts.';
        } else {
            errorMessage += `Error: ${error.message}\n\n🆘 **Troubleshooting:** Visit our [help page](https://gogesmemebot.gogebot.art/spotify/help) for solutions.`;
        }

        await interaction.editReply({ content: errorMessage });
    }
}

async function handleDevices(interaction, userId) {
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        throw new Error('User not authenticated');
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        throw new Error('User not authenticated');
    }

    const limit = interaction.options.getInteger('limit') || 10;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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
    // Check both authentication systems
    const localAuth = isUserAuthenticated(userId);
    const workerAuth = await workerIsUserAuthenticated(userId);
    
    if (!localAuth && !workerAuth) {
        throw new Error('User not authenticated');
    }

    const songInput = interaction.options.getString('song');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
        let trackUri = null;
        
        if (isSpotifyUrl(songInput)) {
            const trackId = getSpotifyTrackId(songInput);
            if (trackId) {
                trackUri = `spotify:track:${trackId}`;
            } else {
                throw new Error('Invalid Spotify URL format');
            }
        } else {
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

async function handleDebug(interaction, userId) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    try {
        // Get authentication status from both systems
        const localAuth = isUserAuthenticated(userId);
        const workerAuth = await workerIsUserAuthenticated(userId);
        const localStatus = getAuthStatus(userId);
        const workerToken = await getUserToken(userId);
        
        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🔍 Spotify Authentication Debug')
            .setDescription(`Debug information for user: <@${userId}>`)
            .addFields(
                {
                    name: '🤖 Local System (Bot Memory)',
                    value: `**Authenticated:** ${localAuth ? '✅' : '❌'}\n` +
                          `**Has Pending Auth:** ${localStatus.hasPendingAuth ? '✅' : '❌'}\n` +
                          `**User Data:** ${localStatus.userData ? '✅' : '❌'}`,
                    inline: true
                },
                {
                    name: '☁️ Worker System (KV Store)',
                    value: `**Authenticated:** ${workerAuth ? '✅' : '❌'}\n` +
                          `**Token Exists:** ${workerToken ? '✅' : '❌'}\n` +
                          `**Token Valid:** ${workerToken && workerToken.expiresAt > Date.now() ? '✅' : '❌'}`,
                    inline: true
                },
                {
                    name: '🔧 Recommendation',
                    value: !localAuth && !workerAuth ? 
                          '**Action:** Use `/spotify login` to authenticate' :
                          localAuth && workerAuth ?
                          '**Status:** ✅ Fully authenticated (both systems)' :
                          localAuth && !workerAuth ?
                          '**Issue:** ⚠️ Local auth only - OAuth callback may have failed' :
                          '**Issue:** ⚠️ Worker auth only - Local session expired',
                    inline: false
                }
            )
            .setTimestamp();

        if (localStatus.userData) {
            embed.addFields({
                name: '📊 Local Token Info',
                value: `**Spotify User:** ${localStatus.userData.spotifyUserId}\n` +
                      `**Display Name:** ${localStatus.userData.displayName}\n` +
                      `**Product:** ${localStatus.userData.product}\n` +
                      `**Expires:** <t:${Math.floor(localStatus.userData.expiresAt / 1000)}:R>`,
                inline: false
            });
        }

        if (workerToken) {
            embed.addFields({
                name: '☁️ Worker Token Info',
                value: `**Spotify User:** ${workerToken.spotifyUserId || 'Unknown'}\n` +
                      `**Display Name:** ${workerToken.displayName || 'Unknown'}\n` +
                      `**Expires:** <t:${Math.floor((workerToken.expiresAt || 0) / 1000)}:R>`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error in debug command:', error);
        await interaction.editReply({
            content: `❌ **Debug Error:** ${error.message}`,
            flags: MessageFlags.Ephemeral
        });
    }
} 