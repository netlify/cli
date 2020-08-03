const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'gatsby-config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['gatsby'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start', 'develop', 'dev'],
    preferredCommand: 'gatsby develop',
  })

  return {
    framework: 'gatsby',
    frameworkPort: 8000,
    env: { GATSBY_LOGGER: 'yurnalist' },
    watchCommands,
    dist: 'public',
  }
}
