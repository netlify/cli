const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['vite'])) return false

  /** everything below now assumes that we are within vite */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['dev', 'serve'],
    preferredCommand: 'vite',
  })

  return {
    framework: 'vite',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'dist',
  }
}
