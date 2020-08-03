const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['nuxt'])) return false

  /** everything below now assumes that we are within vue */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['dev', 'start'],
    preferredCommand: 'nuxt',
  })

  return {
    framework: 'nuxt',
    frameworkPort: 3000,
    watchCommands,
    dist: 'dist',
  }
}
