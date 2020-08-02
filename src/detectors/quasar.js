const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@quasar/app'])) return false

  /** everything below now assumes that we are within Quasar */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['serve', 'start', 'run', 'dev'],
    // NOTE: this is comented out as it was picking this up in cordova related scripts.
    // preferredCommand: "quasar dev"
  })

  if (possibleArgsArrs.length === 0) {
    // offer to run this default when the user doesnt have any matching scripts setup!
    possibleArgsArrs.push(['quasar', 'dev', '-p 8081'])
  }

  return {
    framework: 'quasar',
    command: getYarnOrNPMCommand(),
    frameworkPort: 8081,
    possibleArgsArrs,
    dist: '.quasar',
  }
}
