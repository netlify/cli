const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['sapper'])) return false

  /** everything below now assumes that we are within Sapper */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['dev', 'start'],
    preferredCommand: 'sapper dev',
  })

  return {
    framework: 'sapper',
    frameworkPort: 3000,
    watchCommands,
    dist: 'static',
  }
}
