const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@phenomic/core'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start'],
    preferredCommand: 'phenomic start',
  })

  return {
    framework: 'phenomic',
    frameworkPort: 3333,
    watchCommands,
    dist: 'public',
  }
}
