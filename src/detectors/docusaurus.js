const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false

  const hasV1 = hasRequiredDeps(['docusaurus'])
  const hasV2 = hasRequiredDeps(['@docusaurus/core'])

  // REQUIRED DEPS
  if (!hasV1 && !hasV2) return false

  // REQUIRED CONFIG FILE
  const hasConfigFile = hasV1 ? hasRequiredFiles(['siteConfig.js']) : hasRequiredFiles(['docusaurus.config.js'])

  if (!hasConfigFile) return false

  /** everything below now assumes that we are within gatsby */

  const v1Command = {
    preferredScriptsArr: ['start'],
    preferredCommand: 'docusaurus-start',
  }

  const v2Command = {
    preferredScriptsArr: ['start'],
    preferredCommand: 'docusaurus start',
  }

  const possibleArgsArrs = scanScripts(hasV1 ? v1Command : v2Command)

  return {
    framework: 'docusaurus',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    env: { BROWSER: 'none' },
    possibleArgsArrs,
    dist: 'static',
  }
}
