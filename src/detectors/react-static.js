const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
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
    frameworkPort: 3000,
    possibleArgsArrs,
    dist: 'dist',
  }
}
