# AI Coding Assistant Guidelines for Goge's Memebot Workspace (Enhanced)

## 🎯 Project Overview
This workspace contains a sophisticated Discord music bot with multi-source streaming capabilities, automated cookie management, and intelligent fallback systems. The bot supports YouTube, Spotify, and SoundCloud integration with advanced error handling and user experience optimization.

## 📋 General Principles

### **Clarity and Readability**
- **Code Documentation**: Every function should have clear JSDoc comments explaining purpose, parameters, and return values
- **Variable Naming**: Use descriptive names that explain the purpose (e.g., `isSpotifyTrack` not `isST`)
- **Function Length**: Keep functions under 50 lines when possible; break complex logic into smaller, focused functions
- **Code Organization**: Group related functionality together and separate concerns clearly

### **Project Consistency**
- **Existing Patterns**: Follow established patterns in the codebase (e.g., error handling, logging format, async/await usage)
- **File Structure**: Maintain the current modular structure (`media/`, `commands/` directories)
- **Naming Conventions**: Follow camelCase for variables/functions, PascalCase for classes, UPPER_CASE for constants
- **Import/Export Style**: Use consistent module import/export patterns throughout the project

### **Efficiency and Performance**
- **Asynchronous Operations**: Always use async/await for I/O operations (file reading, API calls, Discord interactions)
- **Memory Management**: Properly dispose of streams, processes, and resources to prevent memory leaks
- **Caching Strategies**: Implement intelligent caching for frequently accessed data (song metadata, search results)
- **Rate Limiting**: Respect Discord API rate limits and implement appropriate delays

### **Safety and Security**
- **Input Validation**: Validate all user inputs, especially URLs and search queries
- **Error Boundaries**: Implement comprehensive error handling to prevent bot crashes
- **Sensitive Data**: Never hardcode tokens, API keys, or credentials; use environment variables
- **Process Management**: Properly kill yt-dlp processes to prevent resource exhaustion

## 🔧 Discord.js Specific Guidelines

### **Interaction Handling**
- **Response Timing**: Always defer replies for operations that might take >3 seconds
- **Error Responses**: Provide meaningful error messages to users, not technical details
- **Ephemeral Messages**: Use ephemeral responses for error messages and user-specific information
- **Component Lifecycle**: Properly handle component collectors and their cleanup

### **Voice Channel Management**
- **Connection Lifecycle**: Always check for existing connections before creating new ones
- **Graceful Disconnection**: Properly destroy connections and clean up resources
- **Permission Checking**: Verify bot has necessary permissions before attempting voice operations
- **Error Recovery**: Implement reconnection logic for dropped voice connections

## 🎵 Music Bot Specific Practices

### **Multi-Source Strategy**
- **Fallback Chain**: Always implement fallback sources (Spotify → YouTube → SoundCloud → Hardcoded)
- **Source Priority**: Prioritize based on reliability and quality (YouTube first, then SoundCloud)
- **Timeout Management**: Use appropriate timeouts for each source to prevent hanging operations
- **Result Validation**: Validate search results before adding to queue

### **Queue Management**
- **Thread Safety**: Ensure queue operations are atomic to prevent race conditions
- **Memory Efficiency**: Implement queue size limits to prevent memory exhaustion
- **State Persistence**: Consider queue state recovery after bot restarts
- **User Experience**: Provide clear feedback about queue status and operations

### **Streaming and Playback**
- **Prebuffering**: Implement smart prebuffering for smooth playback transitions
- **Format Selection**: Use consistent audio format selection (`bestaudio`) across all sources
- **Error Recovery**: Automatically retry failed streams with alternative sources
- **Process Cleanup**: Always kill yt-dlp processes when streams end or fail

## 🍪 Cookie Management Best Practices

### **Automated Refresh System**
- **Bot Detection**: Monitor for YouTube bot verification patterns in all yt-dlp operations
- **Proactive Refresh**: Refresh cookies before they expire (6-hour intervals)
- **Multi-Browser Support**: Try multiple browsers in order of reliability
- **Backup Strategy**: Always backup working cookies before attempting refresh

### **Error Handling**
- **Graceful Degradation**: Continue operation with fallback sources if cookie refresh fails
- **User Communication**: Inform users about temporary YouTube unavailability if needed
- **Retry Logic**: Implement intelligent retry with exponential backoff
- **Logging**: Log cookie operations for debugging without exposing sensitive data

## 📝 Code Writing and Modification Guidelines

### **Error Handling Patterns**
```javascript
// ✅ Good: Comprehensive error handling
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  console.error(`Operation failed: ${error.message}`);
  if (isRetryableError(error)) {
    return await retryWithFallback();
  }
  throw new CustomError('Operation failed after retries', error);
}

// ❌ Bad: Bare try-catch without context
try {
  await riskyOperation();
} catch (e) {
  console.log(e);
}
```

### **Logging Standards**
- **Structured Logging**: Use consistent log formats with context
- **Log Levels**: Use appropriate prefixes (`[DEBUG]`, `[ERROR]`, `[INFO]`)
- **Sensitive Data**: Never log tokens, API keys, or user personal information
- **Performance Logging**: Log timing for long-running operations

### **Testing Considerations**
- **Testable Code**: Write functions that can be easily unit tested
- **Mocking**: Design code to allow mocking of external dependencies
- **Edge Cases**: Consider and handle edge cases (empty queues, invalid URLs, network failures)
- **Integration Points**: Test Discord interaction flows and voice channel operations

### **Dependencies Management**
- **Minimal Dependencies**: Only add dependencies that provide significant value
- **Version Pinning**: Use specific versions for critical dependencies
- **Security Updates**: Regularly update dependencies for security patches
- **Documentation**: Document why each dependency is needed

## 🏗️ File and Project Structure

### **Directory Organization**
```
├── commands/           # Discord slash commands
├── media/             # Music streaming and management
│   ├── cookieManager.js    # Automated cookie management
│   ├── musicAggregator.js  # Multi-source music search
│   ├── streamManager.js    # Audio streaming logic
│   ├── queueManager.js     # Queue operations
│   └── spotifyUtils.js     # Spotify API integration
├── config.env         # Environment variables
└── replit_memebot.js  # Main bot entry point
```

### **File Naming Conventions**
- **Commands**: Use descriptive names (`music.js`, `weather.js`)
- **Utilities**: Use purpose-based names (`cookieManager.js`, `spotifyUtils.js`)
- **Modules**: Use camelCase for file names
- **Constants**: Use UPPER_CASE for constant files if created

### **Import/Export Patterns**
```javascript
// ✅ Good: Named exports with destructuring
const { cookieManager } = require('./media/cookieManager');
const { aggregateMusicSearch } = require('./media/musicAggregator');

// ✅ Good: Clear module exports
module.exports = {
    cookieManager,
    CookieManager
};
```

## 🚀 Deployment and Operations

### **Environment Configuration**
- **Required Variables**: Document all required environment variables
- **Default Values**: Provide sensible defaults where possible
- **Validation**: Validate environment configuration at startup
- **Security**: Use secure methods for storing sensitive configuration

### **Monitoring and Health Checks**
- **Status Endpoints**: Implement health check endpoints for monitoring
- **Resource Monitoring**: Monitor memory usage, especially for long-running processes
- **Error Reporting**: Implement error reporting for production issues
- **Performance Metrics**: Track response times and success rates

### **Zipping and Distribution**
- **Excluded Files**: ALWAYS exclude: `.DS_Store`, `node_modules/`, `venv/`, `.vscode/`, `.cursor/`, `package-lock.json`
- **Naming Convention**: Use `goges_memebot.zip` for consistency
- **Cleanup**: Delete old zip files before creating new ones
- **Content Validation**: Verify zip contents include all necessary files

## 🔒 Security Guidelines

### **Input Validation**
- **URL Validation**: Validate and sanitize all URLs before processing
- **Query Sanitization**: Clean search queries to prevent injection attacks
- **Size Limits**: Implement reasonable limits on input sizes
- **Rate Limiting**: Implement user-based rate limiting for commands

### **Process Security**
- **Process Isolation**: Run yt-dlp processes with limited permissions when possible
- **Timeout Enforcement**: Always use timeouts for external process execution
- **Resource Limits**: Implement memory and CPU limits for spawned processes
- **Cleanup Procedures**: Ensure all processes are properly terminated

## 🐛 Debugging and Troubleshooting

### **Logging Strategy**
```javascript
// ✅ Good: Contextual logging
console.log(`[${moduleName}] Operation started for user ${userId}`);
console.error(`[${moduleName}] Failed to process ${songTitle}: ${error.message}`);

// ✅ Good: Performance logging
const startTime = Date.now();
// ... operation ...
console.log(`[${moduleName}] Operation completed in ${Date.now() - startTime}ms`);
```

### **Error Tracking**
- **Error Context**: Include relevant context in error messages
- **Stack Traces**: Preserve stack traces for debugging
- **User-Friendly Messages**: Translate technical errors to user-friendly messages
- **Error Categories**: Categorize errors by type (network, permission, validation, etc.)

## 🚫 What NOT to Do

### **Code Quality**
- **Don't** introduce overly complex solutions without clear justification
- **Don't** hardcode values that should be configurable
- **Don't** ignore errors or use empty catch blocks
- **Don't** create circular dependencies between modules

### **Security**
- **Don't** log sensitive information (tokens, API keys, user data)
- **Don't** trust user input without validation
- **Don't** expose internal error details to users
- **Don't** run untrusted code or commands

### **Performance**
- **Don't** create memory leaks by not cleaning up resources
- **Don't** make unnecessary API calls or database queries
- **Don't** block the event loop with synchronous operations
- **Don't** ignore rate limits and abuse external APIs

### **User Experience**
- **Don't** make users wait without feedback
- **Don't** show technical error messages to end users
- **Don't** ignore accessibility considerations
- **Don't** make breaking changes without migration strategies

## 📊 Code Review Checklist

Before implementing changes, verify:
- [ ] Error handling is comprehensive and appropriate
- [ ] Resources are properly cleaned up (processes, streams, connections)
- [ ] Logging provides sufficient context for debugging
- [ ] User feedback is clear and helpful
- [ ] Security considerations are addressed
- [ ] Performance impact is considered
- [ ] Code follows project conventions
- [ ] Documentation is updated if needed
- [ ] Edge cases are handled appropriately
- [ ] Dependencies are justified and secure

## 🎯 Success Metrics

Measure success by:
- **Reliability**: Reduced error rates and improved uptime
- **Performance**: Faster response times and lower resource usage
- **User Experience**: Positive user feedback and increased usage
- **Maintainability**: Easier debugging and feature development
- **Security**: No security incidents or vulnerabilities
- **Stability**: Consistent operation without manual intervention

---

*This document should be reviewed and updated regularly as the project evolves and new patterns emerge.*