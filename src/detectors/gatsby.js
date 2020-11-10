const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8000

module.exports = function detector() {
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
    frameworkPort: FRAMEWORK_PORT,
    env: { GATSBY_LOGGER: 'yurnalist' },
    possibleArgsArrs,
    dist: 'public',
  }
}
