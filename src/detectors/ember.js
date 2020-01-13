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
    preferredCommand: 'ember serve'
  })

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['ember', 'serve'])
  }

  return {
    type: 'ember-cli',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 4200,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${4200}(/)?`, 'g'),
    dist: 'dist'
  }
}
