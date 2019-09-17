const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'static.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['react-static'])) return false

  /** everything below now assumes that we are within react-static */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'develop', 'dev'],
    preferredCommand: 'react-static start'
  })

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['react-static', 'start'])
  }
  return {
    type: 'react-static',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 3000,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${3000}(/)?`, 'g'),
    dist: 'dist'
  }
}
