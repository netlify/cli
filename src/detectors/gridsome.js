const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8080

module.exports = function detector() {
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
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'dist',
  }
}
