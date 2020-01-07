const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'app.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['expo'])) return false

  /** everything below now assumes that we are within expo */

  const possibleArgsArrs = scanScripts({
    // prefer the `start:web` script instead of expo's default `web` since that runs
    // `expo start --web`, which auto launches the (non-proxied) web browser.
    preferredScriptsArr: ['start:web'],
    // `expo start:web` does not auto launch the web browser
    preferredCommand: 'expo start:web'
  })

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['expo', 'start:web'])
  }
  return {
    type: 'expo',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 19006,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${19006}(/)?`, 'g'),
    dist: 'web-build'
  }
}
