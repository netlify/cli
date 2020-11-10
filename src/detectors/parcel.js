const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 1234

module.exports = function detector() {
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
    frameworkPort: FRAMEWORK_PORT,
    possibleArgsArrs,
    dist: 'dist',
  }
}
