const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3333

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'brunch-config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['brunch'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start'],
    preferredCommand: 'brunch watch --server',
  })

  return {
    framework: 'brunch',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'app/assets',
  }
}
