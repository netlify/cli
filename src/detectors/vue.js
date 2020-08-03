const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@vue/cli-service'])) return false

  /** everything below now assumes that we are within vue */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['serve', 'start', 'run'],
    preferredCommand: 'vue-cli-service serve',
  })

  return {
    framework: 'vue',
    command: getYarnOrNPMCommand(),
    frameworkPort: 8080,
    possibleArgsArrs,
    dist: 'dist',
  }
}
