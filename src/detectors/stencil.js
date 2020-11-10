const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

// the port that stencil normally outputs
const FRAMEWORK_PORT = 3333
const ENV_PORT = 3000

//
// detection logic - artificial intelligence!
//
module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'stencil.config.ts'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@stencil/core'])) return false

  /** everything below now assumes that we are within stencil */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start'],
    preferredCommand: 'stencil build --dev --watch --serve',
  })

  return {
    framework: 'stencil',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT,
    env: { BROWSER: 'none', PORT: ENV_PORT },
    possibleArgsArrs,
    dist: 'www',
  }
}
