const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['nuxt'])) return false

  /** everything below now assumes that we are within vue */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'start'],
    preferredCommand: 'nuxt'
  })

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['nuxt'])
  }

  return {
    type: 'nuxt',
    command: getYarnOrNPMCommand(),
    port: 8888,
    proxyPort: 3000,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${3000}(/)?`, 'g'),
    dist: 'dist'
  }
}
