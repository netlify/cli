const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

/**
 * detection logic - artificial intelligence!
 * */
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'stencil.config.ts'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@stencil/core'])) return false

  /** everything below now assumes that we are within stencil */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start'],
    preferredCommand: 'stencil build --dev --watch --serve',
  })

  return {
    framework: 'stencil',
    frameworkPort: 3333, // the port that stencil normally outputs
    env: { BROWSER: 'none', PORT: 3000 },
    watchCommands,
    dist: 'www',
  }
}
