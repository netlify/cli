const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', '_config.yml'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['hexo'])) return false

  /** everything below now assumes that we are within gatsby */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'dev', 'develop'],
    preferredCommand: 'hexo server',
  })

  return {
    framework: 'hexo',
    command: getYarnOrNPMCommand(),
    frameworkPort: 4000,
    possibleArgsArrs,
    dist: 'public',
  }
}
