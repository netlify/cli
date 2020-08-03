const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
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
    frameworkPort: 8080,
    possibleArgsArrs,
    dist: '.vuepress/dist',
  }
}
