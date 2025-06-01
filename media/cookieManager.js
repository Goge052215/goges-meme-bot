/**
 * Cookie Manager - Simplified for SoundCloud fallback support
 * Since we're Spotify-focused, this is primarily for SoundCloud fallback
 */

const youtubeDl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');

class CookieManager {
    constructor() {
        this.cookiesPath = path.resolve(process.cwd(), 'cookies.txt');
        this.cookiesValid = false;
        this.lastValidationTime = 0;
        this.validationCooldown = 300000; // 5 minutes
    }

    /**
     * Check if cookies file exists and has content
     */
    cookiesExist() {
        try {
            return fs.existsSync(this.cookiesPath) && fs.statSync(this.cookiesPath).size > 100;
        } catch (error) {
            return false;
        }
    }

    /**
     * Simplified cookie test (primarily for SoundCloud)
     */
    async testCookies() {
        const now = Date.now();
        
        // Don't test too frequently
        if (now - this.lastValidationTime < this.validationCooldown) {
            console.log('[CookieManager] Skipping cookie test due to cooldown');
            return this.cookiesValid;
        }
        
        if (!this.cookiesExist()) {
            console.log('[CookieManager] No cookies file found');
            this.cookiesValid = false;
            return false;
        }

        try {
            console.log('[CookieManager] Testing cookies for SoundCloud support...');
            
            // Simple test - just check if cookies are readable
                        const cookieContent = fs.readFileSync(this.cookiesPath, 'utf8');
            if (cookieContent && cookieContent.length > 100) {
                console.log('[CookieManager] Cookies are present and readable');
                this.cookiesValid = true;
                this.lastValidationTime = now;
                return true;
            }
        } catch (error) {
            console.log(`[CookieManager] Cookie validation failed: ${error.message}`);
            this.cookiesValid = false;
            this.lastValidationTime = now;
        }
        
        return false;
    }

    /**
     * Get flags for yt-dlp (mainly for SoundCloud fallback)
     */
    async getYtDlpFlags(baseFlags = {}) {
        const flags = { ...baseFlags };
        
        // Only use cookies if they exist and are valid
        if (this.cookiesExist()) {
            const isValid = await this.testCookies();
            if (isValid) {
                flags.cookies = this.cookiesPath;
                console.log('[CookieManager] Using cookies for yt-dlp (SoundCloud)');
            } else {
                console.log('[CookieManager] Skipping invalid cookies');
            }
        } else {
            console.log('[CookieManager] No cookies available');
    }

        // Add basic headers for better success rate
        if (!flags.addHeader) {
            flags.addHeader = [];
        }
        
        const headers = [
            'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'accept-language:en-US,en;q=0.5'
        ];
        
        headers.forEach(header => {
            if (!flags.addHeader.includes(header)) {
                flags.addHeader.push(header);
        }
        });
        
        return flags;
    }

    /**
     * Create a minimal cookies file if none exists
     */
    createMinimalCookies() {
        if (!this.cookiesExist()) {
            console.log('[CookieManager] Creating minimal cookies file for SoundCloud fallback');
            const minimalCookies = [
                '# Netscape HTTP Cookie File',
                '# This file was created by cookieManager.js for SoundCloud fallback support',
                '.soundcloud.com\tTRUE\t/\tFALSE\t1893456000\tsession\tbasic'
            ].join('\n');
            
            try {
                fs.writeFileSync(this.cookiesPath, minimalCookies);
                console.log('[CookieManager] Minimal cookies file created');
            } catch (error) {
                console.error('[CookieManager] Failed to create cookies file:', error.message);
            }
        }
    }

    /**
     * Initialize - simplified for Spotify-focused bot
     */
    async initialize() {
        console.log('[CookieManager] Initializing simplified cookie manager for SoundCloud fallback...');
        
        this.createMinimalCookies();
        await this.testCookies();

        console.log('[CookieManager] Initialization complete');
    }

    /**
     * Cleanup - simplified
     */
    cleanup() {
        console.log('[CookieManager] Cleanup complete');
    }
}

const cookieManager = new CookieManager();

module.exports = {
    cookieManager,
    CookieManager
}; 