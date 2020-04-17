const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'gridsome.config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['gridsome'])) return false

  /** everything below now assumes that we are within gridsome */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['develop'],
    preferredCommand: 'gridsome develop'
  })

  return {
    framework: 'gridsome',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 8080,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${8080}(/)?`, 'g'),
    dist: 'dist'
  }
}
