const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 4200

module.exports = function detector() {
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
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'dist',
  }
}
