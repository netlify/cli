const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['next'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['dev', 'develop', 'start'],
    preferredCommand: 'next',
  })

  return {
    framework: 'next',
    frameworkPort: 3000,
    watchCommands,
    dist: 'out',
  }
}
