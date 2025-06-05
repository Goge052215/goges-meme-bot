const youtubeDl = require('youtube-dl-exec');
const { spotifyApiInstance, isSpotifyUrl, getSpotifyTrackId, getSpotifyTrackInfo } = require('./spotifyUtils');
const { isSoundCloudUrl, isYouTubeUrl } = require('./urlUtils');
const { cookieManager } = require('./cookieManager');
const fs = require('fs');
const path = require('path');
const { aggregateMusicSearch, AggregatedSearchResult } = require('./musicAggregator');

/**
 * Sanitizes a search query to avoid issues with special characters
 * @param {string} query The search query to sanitize
 * @returns {string} The sanitized query
 */
function sanitizeSearchQuery(query) {
  return query.replace(/[&+:;,]/g, ' ')
             .replace(/\s+/g, ' ')
             .trim();
}

/**
 * Determines the best audio source URL and metadata for a given query.
 * It handles Spotify URLs (fetching metadata and searching on YouTube),
 * SoundCloud URLs, direct YouTube URLs, and general search terms.
 * For general terms, it attempts a Spotify pre-fetch before falling back to YouTube search.
 * Uses yt-dlp to extract metadata and the final webpage_url for streaming.
 * 
 * @param {string} query The user's input (song name, URL).
 * @returns {Promise<Object>} An object containing song details (title, webpageUrl, duration, thumbnail, source, originalQuery) or an error object { title, isError, errorMessage }.
 */
async function getBestAudioSource(query) {
  console.log(`Getting best audio source for query "${query}" using aggregated search`);
  
  try {
    const aggregatedResults = await aggregateMusicSearch(query, {
      timeout: 15000,
      sourceTimeout: 7000,
      maxResults: 10
    });
    
    if (aggregatedResults.length === 0) {
      console.log(`No results found for "${query}" using aggregated search`);
      return [{ title: query, isError: true, errorMessage: `No results found for "${query}".` }];
    }
    
    if (aggregatedResults[0].isError) {
      console.log(`Error in aggregated search for "${query}": ${aggregatedResults[0].errorMessage}`);
      return aggregatedResults;
    }
    
    console.log(`Found ${aggregatedResults.length} results using aggregated search for "${query}"`);
    console.log(`Best match: "${aggregatedResults[0].title}" (${aggregatedResults[0].source}) with confidence ${aggregatedResults[0].confidence}`);
    
    const topResult = aggregatedResults[0];
    const alternatives = aggregatedResults.slice(1, 4)
      .filter(result => !result.isError && result.webpageUrl !== topResult.webpageUrl)
      .map(result => result.webpageUrl);
    
    if (alternatives.length > 0) {
      topResult.alternativeUrls = alternatives;
      console.log(`Added ${alternatives.length} alternative URLs from search results`);
    }
    
    return aggregatedResults;
    
  } catch (error) {
    console.error(`Error in aggregated music search for "${query}":`, error.message);
    
    console.log(`Falling back to original implementation for "${query}"`);
    return await getBestAudioSourceLegacy(query);
  }
}

/**
 * Legacy implementation of the audio source finder.
 * Kept as a fallback in case the new implementation fails.
 */
async function getBestAudioSourceLegacy(query) {
  let originalQuery = query;
  let sourceInfo = 'yt-dlp'; 
  let ytDlpQuery = query;
  let spotifyMeta = null;
  let searchPrefix = 'ytsearch3:';

  const cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
  if (!fs.existsSync(cookiesPath)) {
    console.log('cookies.txt not found, creating minimal placeholder');
    fs.writeFileSync(cookiesPath, '# Netscape HTTP Cookie File\n# This is a placeholder. Replace with valid YouTube cookies\n');
  }

  const ytDlpMetadataFlags = {
    dumpSingleJson: true,
    noWarnings: true,
    skipDownload: true,
    cookies: cookiesPath,
    noPlaylist: true,
    noCallHome: true,
    noCheckCertificate: true,
    ignoreErrors: true,
    retries: '3',
    fragmentRetries: '3',
    socketTimeout: '15',
    addHeader: [
      'referer:youtube.com',
      'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'accept-language:en-US,en;q=0.5',
      'dnt:1',
      'upgrade-insecure-requests:1',
      'sec-fetch-dest:document',
      'sec-fetch-mode:navigate',
      'sec-fetch-site:none',
      'sec-fetch-user:?1'
    ],
    defaultSearch: 'ytsearch3',
    format: 'bestaudio'
  };

  if (isSpotifyUrl(query)) {
    const trackId = getSpotifyTrackId(query);
    if (!trackId) return [{ title: originalQuery, isError: true, errorMessage: 'Invalid Spotify URL format.' }];
    
    console.log(`Spotify URL detected. Fetching Spotify meta for ID: ${trackId}`);
    spotifyMeta = await getSpotifyTrackInfo(trackId);
    if (spotifyMeta && spotifyMeta.title) {
      const cleanTitle = spotifyMeta.title.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
      ytDlpQuery = `${searchPrefix}${cleanTitle}`;
      sourceInfo = 'Spotify > YouTube (yt-dlp metadata)';
      console.log(`Spotify meta found: "${spotifyMeta.title}". Will use this for yt-dlp YouTube search to get video URL: "${ytDlpQuery}"`);
    } else {
      console.warn(`Could not get metadata for Spotify track ID ${trackId}. Cannot proceed with YouTube search.`);
      return [{ title: originalQuery, isError: true, errorMessage: `Could not fetch metadata for Spotify track ID ${trackId}.` }];
    }
  } else if (isSoundCloudUrl(query)) {
    console.log(`SoundCloud URL detected: ${query}`);
    ytDlpQuery = query;
    sourceInfo = 'SoundCloud (yt-dlp metadata)';
  } else if (isYouTubeUrl(query)) {
    console.log(`YouTube URL detected: ${query}`);
    ytDlpQuery = query;
    sourceInfo = 'YouTube (yt-dlp metadata)';
  } else {
    console.log(`General search query: "${query}".`);
    if (spotifyApiInstance.getAccessToken()) {
        try {
            console.log(`Attempting Spotify pre-fetch for general query "${query}"`);
            const spotifySearchResults = await spotifyApiInstance.searchTracks(query, { limit: 1 });
            if (spotifySearchResults.body?.tracks?.items?.length > 0) {
                const track = spotifySearchResults.body.tracks.items[0];
                const spotifyTitle = `${track.name} - ${track.artists.map(a => a.name).join(', ')}`;
                spotifyMeta = { title: spotifyTitle, duration: Math.floor(track.duration_ms / 1000), thumbnail: track.album?.images?.[0]?.url };
                const cleanTitle = spotifyTitle.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
                ytDlpQuery = `${searchPrefix}${cleanTitle}`;
                sourceInfo = 'General Search > Spotify > YouTube (yt-dlp metadata)';
                console.log(`Spotify pre-fetch matched: "${spotifyTitle}". Using for yt-dlp YouTube search for metadata: "${ytDlpQuery}"`);
            } else {
                console.log(`No Spotify match for "${query}". Using general yt-dlp YouTube search: "${searchPrefix}${query}"`);
                const cleanQuery = query.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
                ytDlpQuery = `${searchPrefix}${cleanQuery}`;
                sourceInfo = 'General Search > YouTube (yt-dlp metadata)';
            }
        } catch (e) {
            console.warn('Error during Spotify pre-fetch (non-critical). Using general yt-dlp YouTube search for metadata:', e.message);
            const cleanQuery = query.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
            ytDlpQuery = `${searchPrefix}${cleanQuery}`;
            sourceInfo = 'General Search > YouTube (yt-dlp metadata)';
        }
    } else {
        console.log(`No Spotify access token. Using general yt-dlp YouTube search for metadata: "${searchPrefix}${query}"`);
        const cleanQuery = query.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
        ytDlpQuery = `${searchPrefix}${cleanQuery}`;
        sourceInfo = 'General Search > YouTube (yt-dlp metadata)';
    }
  }

  console.log(`About to call youtube-dl-exec for metadata with query: ${ytDlpQuery}`);
  
  try {
    if (ytDlpQuery.startsWith('ytsearch')) {
      console.log('Using simplified approach for search query');
      const cleanQuery = ytDlpQuery.split(':')[1].trim();
      const directYoutubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`;
      console.log(`Using direct YouTube search URL: ${directYoutubeUrl}`);
      
      ytDlpQuery = directYoutubeUrl;
    }
    
    const baseFlags = {
      dumpSingleJson: true,
      noWarnings: true,
      skipDownload: true,
      noPlaylist: true,
      noCallHome: true,
      noCheckCertificate: true,
      ignoreErrors: true,
      retries: '3',
      fragmentRetries: '3',
      socketTimeout: '15',
      defaultSearch: 'ytsearch3',
      format: 'bestaudio'
    };
    
    if (ytDlpQuery.includes('youtube.com/results')) {
      baseFlags.flatPlaylist = true;
    }
    
    const ytDlpFlags = await cookieManager.getYtDlpFlags(baseFlags);
    
    const execResult = await youtubeDl(ytDlpQuery, ytDlpFlags);

    let jsonData;
    if (execResult && typeof execResult === 'string' && execResult.trim() !== '') {
        try {
            jsonData = JSON.parse(execResult);
        } catch (e) {
            console.error('Failed to parse metadata JSON from execResult:', e);
            console.error('execResult (metadata) was:', execResult.substring(0, 1000));
            return [{ title: originalQuery, isError: true, errorMessage: `yt-dlp produced invalid JSON output for metadata.` }];
        }
    } else {
        console.error(`yt-dlp (metadata) returned an unexpected structure or empty output. execResult:`, JSON.stringify(execResult).substring(0,1000));
        return [{ title: originalQuery, isError: true, errorMessage: `yt-dlp returned an unexpected data structure or empty output for metadata.` }];
    }

    let entries = [];
    if (jsonData.entries && jsonData.entries.length > 0) {
        entries = jsonData.entries.filter(entry => 
            entry._type === 'url' ||
            entry.webpage_url ||
            entry.url
        );
        
        if (entries.length > 25) {
            console.log(`Limiting ${entries.length} entries to max 25 for Discord display`);
            entries = entries.slice(0, 25);
        }
        
        console.log(`Filtered ${entries.length} valid entries from yt-dlp results`);
    } else if (jsonData.webpage_url || jsonData.url) {
        entries.push(jsonData);
    }

    if (entries.length === 0) {
      if (jsonData.id) {
        const directUrl = `https://www.youtube.com/watch?v=${jsonData.id}`;
        console.log(`No valid entries, but got an ID. Trying direct URL: ${directUrl}`);
        entries.push({
          id: jsonData.id,
          webpage_url: directUrl,
          title: jsonData.title || originalQuery
        });
      } else {
      return [{ title: originalQuery, isError: true, errorMessage: `No valid video results found for "${originalQuery}".` }];
      }
    }

    const songs = entries.map(videoData => {
      const pageUrl = videoData.webpage_url || videoData.url || 
                     (videoData.id ? `https://www.youtube.com/watch?v=${videoData.id}` : null);
      
      if (!pageUrl) {
        console.warn('Skipping entry with no usable URL:', videoData);
        return null;
      }

      const title = spotifyMeta?.title || videoData.title || originalQuery;
      const duration = spotifyMeta?.duration || videoData.duration;
      const thumbnail = spotifyMeta?.thumbnail || videoData.thumbnails?.[0]?.url;
      const uploader = videoData.uploader || videoData.channel || 'Unknown Artist';
      
      return {
        title: spotifyMeta?.title ? title : `${title} - ${uploader}`,
        webpageUrl: pageUrl,
        duration: duration,
        thumbnail: thumbnail,
        source: sourceInfo,
        originalQuery: originalQuery,
        id: videoData.id || pageUrl
      };
    }).filter(song => song !== null);

    if (songs.length === 0) {
      console.error(`yt-dlp (metadata) did not return any usable webpage_url from entries for "${originalQuery}".`);
      return [{ title: originalQuery, isError: true, errorMessage: `yt-dlp could not find required metadata (webpage_url) for "${originalQuery}".` }];
    }
    
    console.log(`Processed ${songs.length} song(s) from yt-dlp metadata for query "${ytDlpQuery}".`);
    return songs;

  } catch (error) {
    let stderrMessage = error.message;
    if (error.stderr) {
        stderrMessage += '\nSTDERR: ' + error.stderr.toString();
    }
    console.error(`yt-dlp metadata execution error for query "${ytDlpQuery}":`, stderrMessage);

    if (stderrMessage.includes("Sign in to confirm you're not a bot") || 
        stderrMessage.includes("cookies") || 
        stderrMessage.includes("authentication")) {
        
        console.log('Cookie authentication error detected - trying direct YouTube URL as fallback');
        
        try {
            const simpleQuery = originalQuery.replace(/[&+:;,]/g, ' ').replace(/\s+/g, ' ').trim();
            console.log(`Attempting to find video for simplified query: "${simpleQuery}"`);
            return [{ title: originalQuery, isError: true, errorMessage: `YouTube search failed - please try again or use a direct YouTube URL.` }];
        } catch (fallbackError) {
            console.error('Error in direct fallback:', fallbackError.message);
        }
    }
    
    return [{ title: originalQuery, isError: true, errorMessage: `Error executing yt-dlp for metadata for "${originalQuery}".` }];
  }
}

/**
 * Check if a given query matches any known song in our fallback cache
 * @param {string} query - The search query to check
 * @returns {string|null} - YouTube video ID if found, null otherwise
 */
function getDirectVideoIdMatch(query) {
    return null;
}

module.exports = {
    getBestAudioSource,
    getDirectVideoIdMatch
}; 