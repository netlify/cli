const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  if (!hasRequiredFiles(['ember-cli-build.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['ember-cli'])) return false

  /** everything below now assumes that we are within ember */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['serve', 'start', 'run'],
    preferredCommand: 'ember serve',
  })

  return {
    framework: 'ember',
    frameworkPort: 4200,
    watchCommands,
    dist: 'dist',
  }
}
