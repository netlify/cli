const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['next'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'develop', 'start'],
    preferredCommand: 'next',
  })

  return {
    framework: 'next',
    command: getYarnOrNPMCommand(),
    frameworkPort: 3000,
    possibleArgsArrs,
    dist: 'out',
  }
}
