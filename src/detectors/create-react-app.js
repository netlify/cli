const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 3000

//
// detection logic - artificial intelligence!
//
module.exports = function detector() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['react-scripts'])) return false

  /** everything below now assumes that we are within create-react-app */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'serve', 'run'],
    preferredCommand: 'react-scripts start',
  })

  return {
    framework: 'create-react-app',
    command: getYarnOrNPMCommand(),
    frameworkPort: FRAMEWORK_PORT, // the port that create-react-app normally outputs
    env: { BROWSER: 'none', PORT: FRAMEWORK_PORT },
    stdio: ['inherit', 'pipe', 'pipe'],
    possibleArgsArrs,
    dist: 'public',
  }
}
