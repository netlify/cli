const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'siteConfig.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['docusaurus'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start'],
    preferredCommand: 'docusaurus-start',
  })

  return {
    framework: 'docusaurus',
    command: getYarnOrNPMCommand(),
    frameworkPort: 3000,
    possibleArgsArrs,
    dist: 'static',
  }
}
