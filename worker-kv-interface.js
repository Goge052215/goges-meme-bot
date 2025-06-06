require('dotenv').config({ path: './config.env' });
const fetch = require('node-fetch');

// Primary domain with fallback to workers.dev subdomain
const PRIMARY_URL = 'https://gogesmemebot.gogebot.art';
const FALLBACK_URL = 'https://gogesbot.goge052215.workers.dev';
const WORKER_URL = process.env.APP_URL || PRIMARY_URL;

/**
 * Fetch wrapper with domain fallback
 * @param {string} endpoint - API endpoint path
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} API response
 */
async function fetchWithFallback(endpoint, options = {}) {
  try {
    // Try primary domain first
    const response = await fetch(`${WORKER_URL}${endpoint}`, options);
    if (response.ok) return response;
    
    // If primary fails, try fallback domain
    console.log(`Primary domain failed, trying fallback for ${endpoint}`);
    return await fetch(`${FALLBACK_URL}${endpoint}`, options);
  } catch (error) {
    console.error(`Error with primary domain, trying fallback: ${error.message}`);
    return await fetch(`${FALLBACK_URL}${endpoint}`, options);
  }
}

/**
 * Get a user's Spotify token from Workers KV
 * @param {string} userId Discord user ID
 * @returns {Promise<object|null>} Token data or null if not found
 */
async function getUserToken(userId) {
  try {
    const response = await fetchWithFallback(`/api/tokens/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'none'}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error(`[WorkerKV] Error fetching token: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`[WorkerKV] Token fetch error: ${error.message}`);
    return null;
  }
}

/**
 * Get list of all authenticated user IDs
 * @returns {Promise<string[]>} Array of user IDs
 */
async function getAllUserIds() {
  try {
    const response = await fetchWithFallback('/api/tokens', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'none'}`
      }
    });

    if (!response.ok) {
      console.error(`[WorkerKV] Error fetching user IDs: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.userIds || [];
  } catch (error) {
    console.error(`[WorkerKV] User IDs fetch error: ${error.message}`);
    return [];
  }
}

/**
 * Check if a user has valid Spotify authentication
 * @param {string} userId Discord user ID
 * @returns {Promise<boolean>} Whether user is authenticated
 */
async function isUserAuthenticated(userId) {
  const tokenData = await getUserToken(userId);
  return tokenData !== null && tokenData.expiresAt > Date.now();
}

/**
 * Revoke a user's Spotify token (delete from KV)
 * @param {string} userId Discord user ID
 * @returns {Promise<boolean>} Success status
 */
async function revokeUserToken(userId) {
  try {
    const response = await fetchWithFallback(`/api/tokens/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'none'}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error(`[WorkerKV] Token revocation error: ${error.message}`);
    return false;
  }
}

/**
 * Generate Spotify OAuth URL via Worker
 * @param {string} userId Discord user ID
 * @returns {Promise<string|null>} OAuth URL or null on error
 */
async function generateAuthUrl(userId) {
  try {
    const response = await fetchWithFallback('/api/auth/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'none'}`
      },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      console.error(`[WorkerKV] Error generating auth URL: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error(`[WorkerKV] Auth URL generation error: ${error.message}`);
    return null;
  }
}

module.exports = {
  getUserToken,
  getAllUserIds,
  isUserAuthenticated,
  revokeUserToken,
  generateAuthUrl
}; 