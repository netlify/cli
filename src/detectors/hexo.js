const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', '_config.yml'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['hexo'])) return false

  /** everything below now assumes that we are within gatsby */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start', 'dev', 'develop'],
    preferredCommand: 'hexo server',
  })

  return {
    framework: 'hexo',
    frameworkPort: 4000,
    watchCommands,
    dist: 'public',
  }
}
