const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8080

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['vuepress'])) return false

  /** everything below now assumes that we are within vue */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['docs:dev', 'dev', 'run'],
    preferredCommand: 'vuepress dev',
  })

  return {
    framework: 'vuepress',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: '.vuepress/dist',
  }
}
