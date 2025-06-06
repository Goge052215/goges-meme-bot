/**
 * URL and domain utilities for the application
 * Includes fallback mechanisms between primary domain and worker subdomain
 */

// Domain configuration
const DOMAINS = {
  PRIMARY: 'https://gogesmemebot.gogebot.art',
  FALLBACK: 'https://gogesbot.goge052215.workers.dev',
  DISCLOUD: process.env.APP_URL || 'https://gogesbot.discloud.app'
};

/**
 * Get full URL with path, using fallback if specified
 * @param {string} path - Path to append to domain
 * @param {boolean} useFallback - Whether to use fallback domain
 * @returns {string} Complete URL
 */
function getFullUrl(path, useFallback = false) {
  const baseDomain = useFallback ? DOMAINS.FALLBACK : DOMAINS.PRIMARY;
  // Ensure path starts with '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseDomain}${normalizedPath}`;
}

/**
 * Check if a domain is available by making a HEAD request
 * @param {string} domain - Domain to check
 * @returns {Promise<boolean>} True if domain responds
 */
async function isDomainAvailable(domain) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
    
    const response = await fetch(`${domain}/status`, { 
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.log(`Domain ${domain} check failed: ${error.message}`);
    return false;
  }
}

/**
 * Get the best available domain
 * @returns {Promise<string>} The best available domain
 */
async function getBestDomain() {
  // Try primary domain first
  if (await isDomainAvailable(DOMAINS.PRIMARY)) {
    return DOMAINS.PRIMARY;
  }
  
  // Fall back to workers.dev subdomain
  if (await isDomainAvailable(DOMAINS.FALLBACK)) {
    console.log('Primary domain unavailable, using fallback domain');
    return DOMAINS.FALLBACK;
  }
  
  // Ultimate fallback - use DisCloud URL if available
  console.log('Both primary and fallback domains unavailable, using DisCloud URL');
  return DOMAINS.DISCLOUD;
}

function isSoundCloudUrl(url) {
    return url.includes('soundcloud.com');
}

function isYouTubeUrl(url) {
    return url.match(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/);
}

module.exports = {
    DOMAINS,
    getFullUrl,
    isDomainAvailable,
    getBestDomain,
    isSoundCloudUrl,
    isYouTubeUrl
}; 