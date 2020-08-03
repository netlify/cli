const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  if (!hasRequiredFiles(['angular.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@angular/cli'])) return false

  /** everything below now assumes that we are within angular */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['serve', 'start', 'build'],
    preferredCommand: 'ng build --prod',
  })

  return {
    framework: 'angular',
    frameworkPort: 4200,
    watchCommands,
    dist: 'dist',
  }
}
