const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@vue/cli-service'])) return false

  /** everything below now assumes that we are within vue */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['serve', 'start', 'run'],
    preferredCommand: 'vue-cli-service serve',
  })

  return {
    framework: 'vue',
    frameworkPort: 8080,
    watchCommands,
    dist: 'dist',
  }
}
