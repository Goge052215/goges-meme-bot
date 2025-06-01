const fs = require('fs');
const path = require('path');

const playlistsFilePath = path.join(__dirname, '../../playlists.json');

/**
 * Loads playlists from the JSON file.
 */
function loadPlaylists() {
  try {
    if (fs.existsSync(playlistsFilePath)) {
      const data = fs.readFileSync(playlistsFilePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[DEBUG] [PlaylistManager] Error loading playlists:', error);
  }
  return {};
}

/**
 * Saves playlists to the JSON file.
 */
function savePlaylists(playlists) {
  try {
    const data = JSON.stringify(playlists, null, 2);
    fs.writeFileSync(playlistsFilePath, data, 'utf8');
    return true;
  } catch (error) {
    console.error('[DEBUG] [PlaylistManager] Error saving playlists:', error);
    return false;
  }
}

/**
 * Creates a new playlist for a guild.
 */
function createPlaylist(guildId, playlistName) {
  if (!playlistName || playlistName.trim() === '') {
    return { success: false, message: 'Playlist name cannot be empty.' };
  }
  
  const playlists = loadPlaylists();

  if (!playlists[guildId]) {
    playlists[guildId] = {};
  }

  if (playlists[guildId][playlistName]) {
    return { success: false, message: `Playlist "${playlistName}" already exists.` };
  }

  playlists[guildId][playlistName] = {
    name: playlistName,
    songs: [],
    createdAt: new Date().toISOString(),
  };

  if (savePlaylists(playlists)) {
    return { success: true, message: `Playlist "${playlistName}" created successfully!`, playlistName: playlistName };
  } else {
    return { success: false, message: 'Error saving playlists.' };
  }
}

/**
 * Searches for playlists in a guild.
 */
function searchPlaylists(guildId, searchTerm = '') {
  const playlists = loadPlaylists();
  const guildPlaylists = playlists[guildId] || {};
  
  // If no playlists exist for this guild
  if (Object.keys(guildPlaylists).length === 0) {
    return { 
      success: true, 
      playlists: [],
      totalCount: 0,
      message: 'No playlists found for this server.' 
    };
  }
  
  if (!searchTerm.trim()) {
    const playlistsList = Object.values(guildPlaylists).map(playlist => ({
      name: playlist.name,
      songCount: playlist.songs.length,
      createdAt: playlist.createdAt
    }));
    
    return {
      success: true,
      playlists: playlistsList,
      totalCount: playlistsList.length,
      message: `Found ${playlistsList.length} playlist${playlistsList.length !== 1 ? 's' : ''}.`
    };
  }
  
  const searchTermLower = searchTerm.toLowerCase();
  const matchingPlaylists = Object.values(guildPlaylists)
    .filter(playlist => playlist.name.toLowerCase().includes(searchTermLower))
    .map(playlist => ({
      name: playlist.name,
      songCount: playlist.songs.length,
      createdAt: playlist.createdAt
    }));
  
  return {
    success: true,
    playlists: matchingPlaylists,
    totalCount: matchingPlaylists.length,
    message: `Found ${matchingPlaylists.length} playlist${matchingPlaylists.length !== 1 ? 's' : ''} matching "${searchTerm}".`
  };
}

/**
 * Formats playlist search results for display.
 */
function formatPlaylistDisplay(searchResults) {
  if (!searchResults.success) {
    return searchResults.message;
  }
  
  if (searchResults.totalCount === 0) {
    return searchResults.message;
  }
  
  let display = `${searchResults.message}\n\n`;
  
  searchResults.playlists.forEach((playlist, index) => {
    const createdDate = new Date(playlist.createdAt).toLocaleDateString();
    display += `${index + 1}. **${playlist.name}** - ${playlist.songCount} song${playlist.songCount !== 1 ? 's' : ''} (Created: ${createdDate})\n`;
  });
  
  return display;
}

module.exports = {
  createPlaylist,
  loadPlaylists,
  savePlaylists,
  searchPlaylists,
  formatPlaylistDisplay
}; 