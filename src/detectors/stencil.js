const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

/**
 * detection logic - artificial intelligence!
 * */
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'stencil.config.ts'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['@stencil/core'])) return false

  /** everything below now assumes that we are within stencil */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start'],
    preferredCommand: 'stencil build --dev --watch --serve'
  })

  return {
    framework: 'stencil',
    command: getYarnOrNPMCommand(),
    port: 8888, // the port that the Netlify Dev User will use
    proxyPort: 3333, // the port that stencil normally outputs
    env: { ...process.env, BROWSER: 'none', PORT: 3000 },
    possibleArgsArrs,
    urlRegexp: new RegExp(`(http://)([^:]+:)${3000}(/)?`, 'g'),
    dist: 'www'
  }
}
