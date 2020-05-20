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

  if (possibleArgsArrs.length === 0) {
    // ofer to run it when the user doesnt have any scripts setup! 🤯
    possibleArgsArrs.push(['hexo', 'server'])
  }
  return {
    framework: 'hexo',
    command: getYarnOrNPMCommand(),
    port: 8888,
    frameworkPort: 4000,
    env: { ...process.env },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${4000}(/)?`, 'g'),
    dist: 'public',
  }
}
