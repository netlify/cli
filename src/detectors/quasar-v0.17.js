const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8080

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['quasar-cli'])) return false

  /** everything below now assumes that we are within Quasar */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['serve', 'start', 'run', 'dev'],
    // NOTE: this is comented out as it was picking this up in cordova related scripts.
    // preferredCommand: "quasar dev"
  })

  return {
    framework: 'quasar-cli-v0.17',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: '.quasar',
  }
}
