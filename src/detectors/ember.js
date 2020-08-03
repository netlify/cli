const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  if (!hasRequiredFiles(['ember-cli-build.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['ember-cli'])) return false

  /** everything below now assumes that we are within ember */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['serve', 'start', 'run'],
    preferredCommand: 'ember serve',
  })

  return {
    framework: 'ember',
    command: getYarnOrNPMCommand(),
    frameworkPort: 4200,
    possibleArgsArrs,
    dist: 'dist',
  }
}
