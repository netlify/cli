const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

module.exports = function() {
  /* REQUIRED FILES */
  if (!hasRequiredFiles(['package.json'])) return false

  /* REQUIRED DEPS */
  if (!(hasRequiredDeps(['parcel-bundler']) || hasRequiredDeps(['parcel']))) return false

  /* Everything below now assumes that we are within parcel */

  const possibleArgsArrs = scanScripts({
    preferredScriptsArr: ['start', 'dev', 'run'],
    preferredCommand: 'parcel',
  })

  return {
    framework: 'parcel',
    command: getYarnOrNPMCommand(),
    frameworkPort: 1234,
    possibleArgsArrs,
    dist: 'dist',
  }
}
