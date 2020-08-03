const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

/**
 * detection logic - artificial intelligence!
 * */
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['react-scripts'])) return false

  /** everything below now assumes that we are within create-react-app */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start', 'serve', 'run'],
    preferredCommand: 'react-scripts start',
  })

  return {
    framework: 'create-react-app',
    frameworkPort: 3000, // the port that create-react-app normally outputs
    env: { BROWSER: 'none', PORT: 3000 },
    stdio: ['inherit', 'pipe', 'pipe'],
    watchCommands,
    dist: 'public',
  }
}
