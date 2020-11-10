const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'static.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['react-static'])) return false

  /** everything below now assumes that we are within react-static */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'develop', 'dev'],
    preferredCommand: 'react-static start',
  })

  return {
    framework: 'react-static',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'dist',
  }
}
