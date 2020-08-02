const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['nuxt'])) return false

  /** everything below now assumes that we are within vue */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'start'],
    preferredCommand: 'nuxt',
  })

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['nuxt'])
  }

  return {
    framework: 'nuxt',
    command: getYarnOrNPMCommand(),
    frameworkPort: 3000,
    possibleArgsArrs,
    dist: 'dist',
  }
}
