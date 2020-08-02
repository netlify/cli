const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'gridsome.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['gridsome'])) return false

  /** everything below now assumes that we are within gridsome */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['develop'],
    preferredCommand: 'gridsome develop',
  })

  return {
    framework: 'gridsome',
    command: getYarnOrNPMCommand(),
    frameworkPort: 8080,
    possibleArgsArrs,
    dist: 'dist',
  }
}
