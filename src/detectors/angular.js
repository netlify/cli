const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  if (!hasRequiredFiles(['angular.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@angular/cli'])) return false

  /** everything below now assumes that we are within angular */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['serve', 'start', 'build'],
    preferredCommand: 'ng build --prod',
  })

  return {
    framework: 'angular',
    command: getYarnOrNPMCommand(),
    frameworkPort: 4200,
    possibleArgsArrs,
    dist: 'dist',
  }
}
