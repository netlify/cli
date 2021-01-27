const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

module.exports = function detector() {
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
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'out',
    disableLocalServerPolling: true,
  }
}
