function isSoundCloudUrl(url) {
    return url.includes('soundcloud.com');
}

function isYouTubeUrl(url) {
    return url.match(/^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/);
}

module.exports = {
    isSoundCloudUrl,
    isYouTubeUrl
}; 