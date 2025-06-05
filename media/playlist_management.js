const fs = require('fs');
const path = require('path');
const { musicPageRank } = require('./musicPageRank');

const playlistsFilePath = path.join(__dirname, '../../playlists.json');

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

function addSongToPlaylist(guildId, playlistName, song) {
  const playlists = loadPlaylists();
  
  if (!playlists[guildId] || !playlists[guildId][playlistName]) {
    return { success: false, message: `Playlist "${playlistName}" not found.` };
  }
  
  const playlist = playlists[guildId][playlistName];
  
  const songId = song.id || song.webpageUrl || `${song.source}_${song.title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}`;
  
  playlist.songs.push({
    ...song,
    addedAt: new Date().toISOString(),
    id: songId
  });
  
  if (playlist.songs.length > 1) {
    try {
      const songIds = playlist.songs.map(s => s.id);
      musicPageRank.recordPlaylistCooccurrence(songIds, {
        playlistName,
        guildId,
        songCount: playlist.songs.length
      });
      console.log(`[PlaylistManager] Recorded PageRank relationships for playlist "${playlistName}" with ${songIds.length} songs`);
    } catch (error) {
      console.error('[PlaylistManager] PageRank recording failed:', error.message);
    }
  }
  
  if (savePlaylists(playlists)) {
    return { 
      success: true, 
      message: `Added "${song.title}" to playlist "${playlistName}"!`,
      songCount: playlist.songs.length
    };
  } else {
    return { success: false, message: 'Error saving playlist.' };
  }
}

function getPlaylistWithRecommendations(guildId, playlistName) {
  const playlists = loadPlaylists();
  
  if (!playlists[guildId] || !playlists[guildId][playlistName]) {
    return { success: false, message: `Playlist "${playlistName}" not found.` };
  }
  
  const playlist = playlists[guildId][playlistName];
  
  const songsWithScores = playlist.songs.map(song => {
    const pageRankScore = musicPageRank.getSongScore(song.id);
    return {
      ...song,
      pageRankScore,
      isPopular: pageRankScore > 0.001 
    };
  });
  
  songsWithScores.sort((a, b) => (b.pageRankScore || 0) - (a.pageRankScore || 0));
  
  return {
    success: true,
    playlist: {
      ...playlist,
      songs: songsWithScores
    },
    recommendations: getPlaylistRecommendations(songsWithScores)
  };
}

function getPlaylistRecommendations(playlistSongs) {
  if (playlistSongs.length === 0) return [];
  
  try {
    const songIds = playlistSongs.map(s => s.id);
    const stats = musicPageRank.getGraphStats();
    
    const recommendations = stats.topSongs
      .filter(song => !songIds.includes(song.songId))
      .slice(0, 3)
      .map(song => ({
        title: song.metadata?.title || 'Unknown',
        score: parseFloat(song.score),
        source: song.metadata?.source || 'Unknown'
      }));
    
    return recommendations;
  } catch (error) {
    console.error('[PlaylistManager] Recommendation generation failed:', error.message);
    return [];
  }
}

function recordPlaylistPlaySession(guildId, playlistName) {
  const playlists = loadPlaylists();
  
  if (!playlists[guildId] || !playlists[guildId][playlistName]) {
    return false;
  }
  
  const playlist = playlists[guildId][playlistName];
  
  if (playlist.songs.length > 1) {
    try {
      const songIds = playlist.songs.map(s => s.id);
      musicPageRank.recordQueueCooccurrence(songIds);
      console.log(`[PlaylistManager] Recorded play session for playlist "${playlistName}"`);
      return true;
    } catch (error) {
      console.error('[PlaylistManager] Play session recording failed:', error.message);
    }
  }
  
  return false;
}

function searchPlaylists(guildId, searchTerm = '') {
  const playlists = loadPlaylists();
  const guildPlaylists = playlists[guildId] || {};
  
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
  addSongToPlaylist,
  getPlaylistWithRecommendations,
  recordPlaylistPlaySession,
  loadPlaylists,
  savePlaylists,
  searchPlaylists,
  formatPlaylistDisplay
}; 