const { hasRequiredDeps, hasRequiredFiles, getWatchCommands } = require('./utils/jsdetect')

module.exports = function() {
  /* REQUIRED FILES */
  if (!hasRequiredFiles(['package.json'])) return false

  /* REQUIRED DEPS */
  if (!(hasRequiredDeps(['parcel-bundler']) || hasRequiredDeps(['parcel']))) return false

  /* Everything below now assumes that we are within parcel */

  const watchCommands = getWatchCommands({
    preferredScriptsArr: ['start', 'dev', 'run'],
    preferredCommand: 'parcel',
  })

  return {
    framework: 'parcel',
    frameworkPort: 1234,
    watchCommands,
    dist: 'dist',
  }
}
