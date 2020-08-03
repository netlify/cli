const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'brunch-config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['brunch'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start'],
    preferredCommand: 'brunch watch --server',
  })

  return {
    framework: 'brunch',
    frameworkPort: 3333,
    watchCommands,
    dist: 'app/assets',
  }
}
