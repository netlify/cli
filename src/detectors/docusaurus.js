const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'siteConfig.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['docusaurus'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start'],
    preferredCommand: 'docusaurus-start',
  })

  return {
    framework: 'docusaurus',
    frameworkPort: 3000,
    watchCommands,
    dist: 'static',
  }
}
