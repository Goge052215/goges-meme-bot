const { AudioPlayerStatus, createAudioResource, demuxProbe } = require('@discordjs/voice');
const youtubeDl = require('youtube-dl-exec');
const { getQueue, queues } = require('./queueManager');
const { isSpotifyUrl } = require('./spotifyUtils');
const { aggregateMusicSearch } = require('./musicAggregator');
const { cookieManager } = require('./cookieManager');
const { performanceMonitor } = require('./performanceMonitor');
const path = require('path');
const fs = require('fs');
const { getDirectVideoIdMatch } = require('./sourceFetcher');
const axios = require('axios');

const activeProcesses = new Map();
const MAX_CONCURRENT_PROCESSES = 3;
let processCount = 0;

const streamCache = new Map();
const STREAM_CACHE_TTL = 5 * 60 * 1000;
const MAX_STREAM_CACHE_SIZE = 20;

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of streamCache.entries()) {
        if (now - value.timestamp > STREAM_CACHE_TTL) {
            streamCache.delete(key);
        }
    }
}, 2 * 60 * 1000);

function trackProcess(processInstance, songTitle) {
    if (processInstance && processInstance.pid) {
        activeProcesses.set(processInstance.pid, {
            process: processInstance,
            songTitle,
            startTime: Date.now()
        });
        processCount++;
    }
}

function untrackProcess(processInstance) {
    if (processInstance && processInstance.pid) {
        activeProcesses.delete(processInstance.pid);
        processCount = Math.max(0, processCount - 1);
    }
}

function killYtDlpProcess(processInstance, songTitle = 'N/A', reason = 'general cleanup') {
  if (processInstance && typeof processInstance.kill === 'function') {
    if (!processInstance.killed) {
      try {
        console.log(`[DEBUG] Killing yt-dlp process (PID: ${processInstance.pid}) for song "${songTitle}". Reason: ${reason}`);
        
        // Untrack process immediately
        untrackProcess(processInstance);
        
        processInstance.kill('SIGTERM');
        
        setTimeout(() => {
          if (!processInstance.killed) {
            try {
              processInstance.kill('SIGKILL');
              console.log(`[DEBUG] Force killed process (PID: ${processInstance.pid}) for "${songTitle}"`);
            } catch (killError) {
              console.log(`[DEBUG] Process (PID: ${processInstance.pid}) for "${songTitle}" already terminated`);
            }
          }
        }, 500); // Reduced timeout for faster cleanup
        
      } catch (e) {
        console.error(`[DEBUG] Error attempting to kill process for "${songTitle}": ${e.message}`);
        untrackProcess(processInstance);
      }
    } else {
      console.log(`[DEBUG] Process for "${songTitle}" was already killed. Reason for check: ${reason}`);
      untrackProcess(processInstance);
    }
  }
}


async function createMediaStream(webpageUrl, retryCount = 0, alternativeUrls = []) {
  const streamStartTime = Date.now();
  console.log(`[DEBUG] Creating media stream with yt-dlp for: ${webpageUrl} (attempt ${retryCount + 1})`);
  
  // Process limiting for better resource management
  if (processCount >= MAX_CONCURRENT_PROCESSES) {
    console.log(`[DEBUG] Too many concurrent processes (${processCount}), waiting...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Clean up old processes
    const now = Date.now();
    for (const [pid, info] of activeProcesses.entries()) {
      if (now - info.startTime > 30000) { // 30 seconds old
        console.log(`[DEBUG] Cleaning up old process ${pid} for "${info.songTitle}"`);
        killYtDlpProcess(info.process, info.songTitle, 'timeout cleanup');
      }
    }
  }
  
  let stderrOutput = '';
  
  try {
    const baseFlags = {
      format: 'bestaudio',
      output: '-',
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
      retries: 3, // Reduced retries for faster failure
      fragmentRetries: 3,
      bufferSize: '8M', // Reduced buffer size
      concurrentFragments: 2, // Reduced concurrent fragments
      socketTimeout: 30 // Reduced timeout
    };
    
    const ytDlpStreamFlags = await cookieManager.getYtDlpFlags(baseFlags);
    
    const ytProcess = youtubeDl.exec(webpageUrl, ytDlpStreamFlags);
    if (!ytProcess.stdout) {
      throw new Error('youtube-dl-exec did not return a stdout stream.');
    }
    
    // Track the process for resource management
    trackProcess(ytProcess, `Stream for ${webpageUrl}`);
    if (ytProcess.stderr) {
      ytProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        stderrOutput += errorText;
        console.error(`[yt-dlp stderr - stream creation] ${errorText}`);
    });
  }
    
    ytProcess.on('error', (err) => {
      console.error(`[DEBUG] yt-dlp stream process error during creation:`, err.message);
  });
    
    ytProcess.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGKILL') {
        console.warn(`[DEBUG] yt-dlp stream process exited unexpectedly with code ${code}, signal ${signal}.`);
    }
  });

  try {
      const { stream, type } = await demuxProbe(ytProcess.stdout);
      performanceMonitor.recordStreamStart(Date.now() - streamStartTime);
      return { stream, type, process: ytProcess }; 
  } catch (probeError) {
    console.error("[DEBUG] demuxProbe Error:", probeError.message);
    
    if (probeError.message && (
      probeError.message.includes('SIGKILL') || 
      probeError.message.includes('killed') ||
      probeError.message.includes('ChildProcessError')
    )) {
      console.log('[DEBUG] Process was terminated (likely intentional), not treating as error');
      throw new Error('Process terminated');
    }
    
    killYtDlpProcess(ytProcess, 'Stream Creation for ' + webpageUrl, 'demuxProbe error');
    
    if (cookieManager.isBotDetectionError(stderrOutput) && retryCount === 0) {
      console.log('[DEBUG] Bot detection found in demuxProbe error, attempting cookie refresh...');
      const refreshSuccess = await cookieManager.handleBotDetection(stderrOutput);
      if (refreshSuccess) {
        console.log('[DEBUG] Retrying stream creation after cookie refresh...');
        return await createMediaStream(webpageUrl, retryCount + 1);
      }
    }
    
    if (alternativeUrls.length > 0 && retryCount === 0) {
      console.log(`[DEBUG] Primary URL failed, trying ${alternativeUrls.length} alternative URLs...`);
      for (let i = 0; i < alternativeUrls.length; i++) {
        const altUrl = alternativeUrls[i];
        console.log(`[DEBUG] Trying alternative URL ${i + 1}/${alternativeUrls.length}: ${altUrl}`);
        try {
          return await createMediaStream(altUrl, retryCount + 1, []);
        } catch (altError) {
          console.log(`[DEBUG] Alternative URL ${i + 1} failed: ${altError.message}`);
          if (i === alternativeUrls.length - 1) {
            console.log(`[DEBUG] All alternative URLs exhausted`);
          }
        }
      }
    }
    
    throw probeError;
    }
  } catch (initialError) {
    console.error(`[DEBUG] Initial stream creation failed: ${initialError.message}`);
    
    const fullErrorText = initialError.message + ' ' + stderrOutput;
    if (cookieManager.isBotDetectionError(fullErrorText) && retryCount === 0) {
      console.log('[DEBUG] Bot detection error detected, trying direct yt-dlp command fallback...');
      
      try {
        console.log('[DEBUG] Attempting direct yt-dlp stream URL extraction');
        const directStreamUrl = await cookieManager.getStreamUrlDirect(webpageUrl);
        
        if (directStreamUrl) {
          console.log('[DEBUG] Got direct stream URL, creating HTTP stream');
          const { stream, type } = await createDirectHttpStream(directStreamUrl);
          
          const mockProcess = {
            pid: 'direct-http',
            kill: () => console.log('[DEBUG] Mock process kill called for direct HTTP stream'),
            killed: false
          };
          
          return { stream, type, process: mockProcess };
        }
      } catch (directError) {
        console.log('[DEBUG] Direct yt-dlp command failed:', directError.message);
        console.log('[DEBUG] Attempting cookie refresh as secondary fallback...');
        
        const refreshSuccess = await cookieManager.handleBotDetection(fullErrorText);
        if (refreshSuccess) {
          console.log('[DEBUG] Retrying stream creation after cookie refresh...');
          return await createMediaStream(webpageUrl, retryCount + 1);
        }
      }
    }
    
    console.log(`[DEBUG] Trying fallback method for: ${webpageUrl}`);
    
    if (webpageUrl.includes('youtube.com') || webpageUrl.includes('youtu.be')) {
      let videoId = null;

      if (webpageUrl.includes('watch?v=')) {
        videoId = new URL(webpageUrl).searchParams.get('v');
      } else if (webpageUrl.includes('youtu.be/')) {
        videoId = webpageUrl.split('youtu.be/')[1].split('?')[0];
      }
      
      if (videoId) {
        console.log(`[DEBUG] Trying direct audio stream approach for video ID: ${videoId}`);
        
        const baseFallbackFlags = {
          format: 'bestaudio/best',
          output: '-',
          noCheckCertificate: true
        };
        
        const fallbackFlags = await cookieManager.getYtDlpFlags(baseFallbackFlags);
        
        const ytProcess = youtubeDl.exec(`https://www.youtube.com/watch?v=${videoId}`, fallbackFlags);
        
        let fallbackStderr = '';
        if (ytProcess.stderr) {
          ytProcess.stderr.on('data', (data) => {
              const errorText = data.toString();
              fallbackStderr += errorText;
              console.error(`[yt-dlp stderr - fallback] ${errorText}`);
          });
        }
        
        try {
          const { stream, type } = await demuxProbe(ytProcess.stdout);
          return { stream, type, process: ytProcess };
        } catch (fallbackError) {
          console.error(`[DEBUG] Fallback stream creation also failed: ${fallbackError.message}`);
          killYtDlpProcess(ytProcess, 'Fallback Stream Creation', 'fallback demuxProbe error');
          
          const fallbackFullError = fallbackError.message + ' ' + fallbackStderr;
          if (cookieManager.isBotDetectionError(fallbackFullError) && retryCount === 0) {
            console.log('[DEBUG] Bot detection in fallback attempt, trying direct yt-dlp command...');
            
            try {
              console.log('[DEBUG] Attempting direct yt-dlp stream URL extraction for fallback');
              const directStreamUrl = await cookieManager.getStreamUrlDirect(webpageUrl);
              
              if (directStreamUrl) {
                console.log('[DEBUG] Got direct stream URL in fallback, creating HTTP stream');
                const { stream, type } = await createDirectHttpStream(directStreamUrl);
                
                const mockProcess = {
                  pid: 'direct-http-fallback',
                  kill: () => console.log('[DEBUG] Mock process kill called for direct HTTP fallback stream'),
                  killed: false
                };
                
                return { stream, type, process: mockProcess };
              }
            } catch (directFallbackError) {
              console.log('[DEBUG] Direct yt-dlp fallback failed:', directFallbackError.message);
              console.log('[DEBUG] Attempting cookie refresh in fallback...');
              
              const refreshSuccess = await cookieManager.handleBotDetection(fallbackFullError);
              if (refreshSuccess) {
                console.log('[DEBUG] Retrying stream creation after fallback cookie refresh...');
                return await createMediaStream(webpageUrl, retryCount + 1);
              }
            }
          }
          
          throw fallbackError;
        }
      }
    }
    
    if (alternativeUrls.length > 0 && retryCount === 0) {
      console.log(`[DEBUG] Primary URL failed, trying ${alternativeUrls.length} alternative URLs...`);
      for (let i = 0; i < alternativeUrls.length; i++) {
        const altUrl = alternativeUrls[i];
        console.log(`[DEBUG] Trying alternative URL ${i + 1}/${alternativeUrls.length}: ${altUrl}`);
        try {
          return await createMediaStream(altUrl, retryCount + 1, []);
        } catch (altError) {
          console.log(`[DEBUG] Alternative URL ${i + 1} failed: ${altError.message}`);
          if (i === alternativeUrls.length - 1) {
            console.log(`[DEBUG] All alternative URLs exhausted`);
          }
        }
      }
    }
    
    throw initialError;
  }
}

async function managePrebuffering(guildId) {
  const queue = getQueue(guildId);

  // Optimize: Only prebuffer if we have enough resources and the queue is stable
  if (queue.songs.length > 1 && !queue.prebufferPromise && !queue.buffer && 
      queue.playing && processCount < MAX_CONCURRENT_PROCESSES - 1) {
    const nextSong = queue.songs[1];

    if (nextSong && nextSong.webpageUrl) {
      console.log(`[DEBUG] [Prebuffer] Initiating for: "${nextSong.title}"`);
      queue.prebufferedSongUrl = nextSong.webpageUrl;
      
      // Add timeout to prebuffering to prevent hanging
      const prebufferTimeout = setTimeout(() => {
        if (queue.prebufferPromise) {
          console.log(`[DEBUG] [Prebuffer] Timeout for "${nextSong.title}"`);
          queue.prebufferPromise = null;
          queue.prebufferedSongUrl = null;
        }
      }, 20000); // 20 second timeout
      
      queue.prebufferPromise = createMediaStream(nextSong.webpageUrl)
        .then(prebufferedMedia => {
          clearTimeout(prebufferTimeout);
          if (queue.songs.length > 1 && queue.songs[1].webpageUrl === nextSong.webpageUrl) {
            console.log(`[DEBUG] [Prebuffer] Successfully completed for: "${nextSong.title}"`);
            queue.buffer = prebufferedMedia;
          } else {
            console.log(`[DEBUG] [Prebuffer] Queue changed during prebuffering of "${nextSong.title}". Discarding buffer.`);
            killYtDlpProcess(prebufferedMedia.process, nextSong.title, 'queue changed during prebuffer');
            if (queue.prebufferedSongUrl === nextSong.webpageUrl) queue.prebufferedSongUrl = null;
          }
        })
        .catch(err => {
          clearTimeout(prebufferTimeout);
          console.error(`[DEBUG] [Prebuffer] Failed for "${nextSong.title}":`, err.message);
          if (queue.prebufferedSongUrl === nextSong.webpageUrl) {
            queue.prebufferedSongUrl = null;
          }
        })
        .finally(() => {
          queue.prebufferPromise = null;
        });
    }
  }
}

async function playSong(guildId, interactionOrCtx) {
  const queue = getQueue(guildId);
  
  if (queue.songs.length === 0) {
    if (queue.textChannel) {
      queue.textChannel.send('Queue is empty. Disconnecting from voice channel.').catch(console.error);
    }
    if (queue.connection) {
      queue.connection.destroy();
      queues.delete(guildId);
    }
    killYtDlpProcess(queue.currentSongProcess, 'Lingering Process', 'queue empty');
    queue.currentSongProcess = null;
    return;
  }

  const song = queue.songs[0];
  console.log(`[DEBUG] Attempting to play: "${song.title}" from webpage: ${song.webpageUrl}`);
  
  if (!song.webpageUrl) {
    console.error(`[DEBUG] No webpageUrl for song: "${song.title}". Skipping.`);
    if (queue.textChannel) {
      queue.textChannel.send(`❌ Could not play "${song.title}". No webpage URL found. Skipping.`).catch(console.error);
    }
    queue.songs.shift();
    playSong(guildId, interactionOrCtx);
    return;
  }

  if (isSpotifyUrl(song.webpageUrl)) {
    if (queue.textChannel) {
      queue.textChannel.send(`🔄 Spotify track detected: **${song.title}**. Finding streamable equivalent...`).catch(console.error);
    }
    console.log(`[DEBUG] Spotify track detected. Finding streamable equivalent for: "${song.title}"`);
    
    const directVideoId = getDirectVideoIdMatch(song.title);
    if (directVideoId) {
      console.log(`[DEBUG] Found direct video ID match: ${directVideoId} for "${song.title}"`);
      song.webpageUrl = `https://www.youtube.com/watch?v=${directVideoId}`;
      song.youtubeEquivalent = true;
    } else {
      let foundEquivalent = false;
      const sourcesToTry = ['youtube', 'soundcloud'];
      
      for (const source of sourcesToTry) {
        try {
          console.log(`[DEBUG] Trying ${source} for "${song.title}"`);
          const results = await aggregateMusicSearch(song.title, {
            sources: [source],
            timeout: 8000,
            maxResults: 1
          });
          
          if (results && results.length > 0 && !results[0].isError) {
            const equivalentSong = results[0];
            console.log(`[DEBUG] Found ${source} equivalent: "${equivalentSong.title}" URL: ${equivalentSong.webpageUrl}`);
            song.webpageUrl = equivalentSong.webpageUrl;
            song.streamingSource = source;
            song.originalSource = 'Spotify';
            foundEquivalent = true;
            break;
          } else {
            console.log(`[DEBUG] No results from ${source} for "${song.title}"`);
          }
        } catch (error) {
          console.log(`[DEBUG] ${source} search failed for "${song.title}": ${error.message}`);
          continue;
        }
      }
      
      if (!foundEquivalent) {
        console.error(`[DEBUG] Failed to find streamable equivalent for "${song.title}" on any platform`);
        if (queue.textChannel) {
          queue.textChannel.send(`❌ Could not find a streamable equivalent for **${song.title}** on YouTube or SoundCloud. Skipping.`).catch(console.error);
        }
        queue.songs.shift();
        playSong(guildId, interactionOrCtx);
        return;
      }
    }
  }

  killYtDlpProcess(queue.currentSongProcess, 'Previous Song', 'new song starting');
  queue.currentSongProcess = null;

  try {
    let media;
    if (queue.buffer && queue.songs.length > 0 && queue.prebufferedSongUrl === song.webpageUrl) {
      console.log(`[DEBUG] Using prebuffered stream for "${song.title}"`);
      media = queue.buffer;
      queue.buffer = null;
      queue.prebufferedSongUrl = null;
      queue.currentSongProcess = media.process;
    } else {
      console.log(`[DEBUG] No prebuffered stream, creating new stream for "${song.title}"`);
      if (queue.buffer && queue.buffer.process) {
          killYtDlpProcess(queue.buffer.process, `Prebuffer for ${queue.prebufferedSongUrl}`, 'discarding stale prebuffer');
          queue.buffer = null;
          queue.prebufferedSongUrl = null;
      }
      
      const alternativeUrls = song.alternativeUrls || [];
      media = await createMediaStream(song.webpageUrl, 0, alternativeUrls);
      queue.currentSongProcess = media.process;
    }

    const resource = createAudioResource(media.stream, { 
      inputType: media.type, 
      inlineVolume: true 
    });
    resource.volume.setVolume(0.5);
    
    queue.player.play(resource);
    queue.playing = true;
    
    managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call:', err));
    
    if (queue.textChannel) {
      queue.textChannel.send(`🎵 Now playing: **${song.title}** (${song.source})`).catch(console.error);
    }

    queue.player.removeAllListeners(AudioPlayerStatus.Idle);
    queue.player.removeAllListeners('error');
    
    queue.player.on(AudioPlayerStatus.Idle, () => {
      console.log(`[DEBUG] Player idle after "${song.title}"`);
      performanceMonitor.recordStreamEnd();
      killYtDlpProcess(queue.currentSongProcess, song.title, 'player idle');
      queue.currentSongProcess = null;

      if (!queue.loop) {
        queue.songs.shift();
      } else {
        const currentSongShifted = queue.songs.shift();
        queue.songs.push(currentSongShifted);
      }
      playSong(guildId, interactionOrCtx);
      managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call from Idle:', err));
    });
    
    queue.player.on('error', error => {
      console.error(`[DEBUG] AudioPlayer Error for "${song.title}":`, error.message);
      
      // Check if this is a process termination error (expected)
      if (error.message && (
        error.message.includes('SIGKILL') || 
        error.message.includes('killed') ||
        error.message.includes('ChildProcessError') ||
        error.message.includes('Process terminated')
      )) {
        console.log('[DEBUG] Player error due to process termination (likely intentional)');
        queue.currentSongProcess = null;
        return;
      }
      
      killYtDlpProcess(queue.currentSongProcess, song.title, 'player error');
      queue.currentSongProcess = null;

      if (song.originalSource === 'Spotify' || song.source === 'Spotify') {
        console.log(`[DEBUG] Song failed, trying alternative sources for "${song.title}"`);
        
        aggregateMusicSearch(song.title, {
          sources: ['youtube', 'soundcloud'],
          timeout: 5000,
          maxResults: 3
        }).then(alternativeResults => {
          if (alternativeResults && alternativeResults.length > 0 && !alternativeResults[0].isError) {
            const currentSource = song.streamingSource || 'youtube';
            const alternative = alternativeResults.find(result => 
              result.source.toLowerCase() !== currentSource.toLowerCase()
            ) || alternativeResults[0];
            
            if (alternative && alternative.webpageUrl !== song.webpageUrl) {
              console.log(`[DEBUG] Found alternative source for "${song.title}": ${alternative.source}`);
              
              song.webpageUrl = alternative.webpageUrl;
              song.streamingSource = alternative.source;
              song.title = alternative.title;
              
              if (queue.textChannel) {
                queue.textChannel.send(`🔄 Retrying **${song.title}** from ${alternative.source}...`).catch(console.error);
              }
              
              playSong(guildId, interactionOrCtx);
              return;
            }
          }
          
          if (queue.textChannel) {
            queue.textChannel.send(`❌ Error playing **${song.title}** and no alternatives found. Skipping.`).catch(console.error);
          }
          queue.songs.shift();
          playSong(guildId, interactionOrCtx);
          managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call from Player Error:', err));
        }).catch(fallbackError => {
          console.error(`[DEBUG] Fallback search failed for "${song.title}": ${fallbackError.message}`);
          if (queue.textChannel) {
            queue.textChannel.send(`❌ Error playing **${song.title}**. Skipping.`).catch(console.error);
          }
          queue.songs.shift();
          playSong(guildId, interactionOrCtx);
          managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call from Player Error:', err));
        });
      } else {
        if (queue.textChannel) {
          queue.textChannel.send(`❌ Error playing **${song.title}**. Skipping.`).catch(console.error);
        }
        if (queue.buffer && queue.buffer.process) {
            killYtDlpProcess(queue.buffer.process, `Prebuffer for ${queue.prebufferedSongUrl}`, 'player error on current song');
            queue.buffer = null;
            queue.prebufferedSongUrl = null;
        }
        if (queue.prebufferPromise) {
            console.log('[DEBUG] Cancelling ongoing prebufferPromise due to player error.');
        }

        queue.songs.shift();
        playSong(guildId, interactionOrCtx);
        managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call from Player Error:', err));
      }
    });
    
  } catch (error) {
    console.error(`[DEBUG] Error in playSong attempting to stream "${song.title}" (URL: ${song.webpageUrl}):`, error.message);
    killYtDlpProcess(queue.currentSongProcess, song.title, 'error in playSong scope');
    queue.currentSongProcess = null;

    if (queue.buffer && queue.buffer.process) {
        killYtDlpProcess(queue.buffer.process, `Prebuffer for ${queue.prebufferedSongUrl}`, 'error in playSong scope for current song');
        queue.buffer = null;
        queue.prebufferedSongUrl = null;
    }

    if (song.originalSource === 'Spotify' || song.source === 'Spotify' || song.streamingSource) {
      console.log(`[DEBUG] Stream creation failed, trying alternative sources for "${song.title}"`);
      
      try {
        const alternativeResults = await aggregateMusicSearch(song.title, {
          sources: ['youtube', 'soundcloud'],
          timeout: 5000,
          maxResults: 3
        });
        
        if (alternativeResults && alternativeResults.length > 0 && !alternativeResults[0].isError) {
          const currentSource = song.streamingSource || (song.webpageUrl.includes('youtube') ? 'youtube' : 'soundcloud');
          const alternative = alternativeResults.find(result => 
            result.source.toLowerCase() !== currentSource.toLowerCase() && 
            result.webpageUrl !== song.webpageUrl
          ) || alternativeResults[0];
          
          if (alternative && alternative.webpageUrl !== song.webpageUrl) {
            console.log(`[DEBUG] Found alternative source for failed stream "${song.title}": ${alternative.source}`);
            
            song.webpageUrl = alternative.webpageUrl;
            song.streamingSource = alternative.source;
            song.title = alternative.title;
            
            if (queue.textChannel) {
              queue.textChannel.send(`🔄 Stream failed, retrying **${song.title}** from ${alternative.source}...`).catch(console.error);
            }
            
            playSong(guildId, interactionOrCtx);
            managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in managePrebuffering call from stream retry:', err));
            return;
          }
        }
      } catch (fallbackError) {
        console.error(`[DEBUG] Alternative source search failed for "${song.title}": ${fallbackError.message}`);
      }
    }

    if (queue.textChannel) {
      queue.textChannel.send(`❌ Failed to initiate streaming for **${song.title}**. Skipping.`).catch(console.error);
    }
    queue.songs.shift();
    playSong(guildId, interactionOrCtx);
    managePrebuffering(guildId).catch(err => console.error('[DEBUG] Error in playSong catch:', err));
  }
}

/**
 * Create a direct HTTP stream from a stream URL
 * @param {string} streamUrl - Direct streaming URL
 * @returns {Promise<{stream: Readable, type: StreamType}>} Stream object
 */
async function createDirectHttpStream(streamUrl) {
  console.log('[DEBUG] Creating direct HTTP stream from URL');
  
  try {
    const response = await axios({
      method: 'GET',
      url: streamUrl,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const { stream, type } = await demuxProbe(response.data);
    console.log('[DEBUG] Direct HTTP stream created successfully');
    return { stream, type };
  } catch (error) {
    console.error('[DEBUG] Direct HTTP stream creation failed:', error.message);
    throw error;
  }
}

module.exports = {
    killYtDlpProcess,
    createMediaStream,
    managePrebuffering,
    playSong,
    createDirectHttpStream
}; 