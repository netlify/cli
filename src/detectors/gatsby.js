const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'gatsby-config.js'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['gatsby'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'develop', 'dev'],
    preferredCommand: 'gatsby develop',
  })

  return {
    framework: 'gatsby',
    command: getYarnOrNPMCommand(),
    frameworkPort: 8000,
    env: { GATSBY_LOGGER: 'yurnalist' },
    possibleArgsArrs,
    dist: 'public',
  }
}
