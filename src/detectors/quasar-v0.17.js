const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
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

  if (possibleArgsArrs.length === 0) {
    // ofer to run this default when the user doesnt have any matching scripts setup!
    possibleArgsArrs.push(['quasar', 'dev'])
  }

  return {
    framework: 'quasar-cli-v0.17',
    command: getYarnOrNPMCommand(),
    frameworkPort: 8080,
    possibleArgsArrs,
    dist: '.quasar',
  }
}
