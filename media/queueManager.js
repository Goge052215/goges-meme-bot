const { createAudioPlayer } = require('@discordjs/voice');
const { NoSubscriberBehavior } = require('@discordjs/voice');

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

module.exports = {
  queues,
  getQueue,
}; 