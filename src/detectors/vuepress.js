const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['vuepress'])) return false

  /** everything below now assumes that we are within vue */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['docs:dev', 'dev', 'run'],
    preferredCommand: 'vuepress dev',
  })

  return {
    framework: 'vuepress',
    frameworkPort: 8080,
    watchCommands,
    dist: '.vuepress/dist',
  }
}
