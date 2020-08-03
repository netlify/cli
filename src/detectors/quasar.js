const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@quasar/app'])) return false

  /** everything below now assumes that we are within Quasar */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['serve', 'start', 'run', 'dev'],
    // NOTE: this is comented out as it was picking this up in cordova related scripts.
    // preferredCommand: "quasar dev"
  })

  return {
    framework: 'quasar',
    frameworkPort: 8081,
    watchCommands,
    dist: '.quasar',
  }
}
