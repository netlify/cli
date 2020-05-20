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

  if (possibleArgsArrs.length === 0) {
    // offer to run it when the user does not have any scripts setup! 🤯
    possibleArgsArrs.push(['ng', 'build', '--prod'])
  }

  return {
    framework: 'angular',
    command: getYarnOrNPMCommand(),
    port: 8888,
    frameworkPort: 4200,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${4200}(/)?`, 'g'),
    dist: 'dist',
  }
}
