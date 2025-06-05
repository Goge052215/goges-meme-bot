const { createAudioPlayer } = require('@discordjs/voice');
const { NoSubscriberBehavior } = require('@discordjs/voice');
const { musicPageRank } = require('./musicPageRank');

const queues = new Map();

function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, {
      songs: [],
      playing: false,
      player: createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Stop,
          maxMissedFrames: Math.round(5000 / 20),
        }
      }),
      connection: null,
      loop: false,
      textChannel: null,
      buffer: null,
      prebufferPromise: null,
      currentSongProcess: null,
      prebufferedSongUrl: null
    });
  }
  return queues.get(guildId);
}

function addSongToQueue(guildId, song) {
  const queue = getQueue(guildId);
  queue.songs.push(song);
  
  if (queue.songs.length > 1) {
    try {
      const songIds = queue.songs.map(s => musicPageRank.getSongId(s));
      musicPageRank.recordQueueCooccurrence(songIds);
    } catch (error) {
      console.log('[QueueManager] PageRank recording failed:', error.message);
    }
  }
  
  return queue;
}

function recordSongPlay(guildId, song) {
  try {
    const songId = musicPageRank.getSongId(song);
    musicPageRank.recordUserPlay(songId, {
      title: song.title,
      source: song.source,
      webpageUrl: song.webpageUrl,
      guildId: guildId
    });
  } catch (error) {
    console.log('[QueueManager] PageRank play recording failed:', error.message);
  }
}

function getQueueSummary(guildId) {
  const queue = getQueue(guildId);
  
  return {
    length: queue.songs.length,
    isPlaying: queue.playing,
    currentSong: queue.songs[0] || null,
    upcomingSongs: queue.songs.slice(1, 6),
    loop: queue.loop
  };
}

module.exports = {
  queues,
  getQueue,
  addSongToQueue,
  recordSongPlay,
  getQueueSummary
}; 