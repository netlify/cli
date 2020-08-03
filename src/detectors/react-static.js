const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'static.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['react-static'])) return false

  /** everything below now assumes that we are within react-static */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start', 'develop', 'dev'],
    preferredCommand: 'react-static start',
  })

  return {
    framework: 'react-static',
    frameworkPort: 3000,
    watchCommands,
    dist: 'dist',
  }
}
