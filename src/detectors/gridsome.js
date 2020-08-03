const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'gridsome.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['gridsome'])) return false

  /** everything below now assumes that we are within gridsome */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['develop'],
    preferredCommand: 'gridsome develop',
  })

  return {
    framework: 'gridsome',
    frameworkPort: 8080,
    watchCommands,
    dist: 'dist',
  }
}
