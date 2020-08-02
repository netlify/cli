const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@phenomic/core'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start'],
    preferredCommand: 'phenomic start',
  })

  return {
    framework: 'phenomic',
    command: getYarnOrNPMCommand(),
    frameworkPort: 3333,
    possibleArgsArrs,
    dist: 'public',
  }
}
