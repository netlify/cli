const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['sapper'])) return false

  /** everything below now assumes that we are within Sapper */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'start'],
    preferredCommand: 'sapper dev',
  })

  return {
    framework: 'sapper',
    command: getYarnOrNPMCommand(),
    frameworkPort: 3000,
    possibleArgsArrs,
    dist: 'static',
  }
}
