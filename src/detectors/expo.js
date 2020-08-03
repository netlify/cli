const { hasRequiredDeps, hasRequiredFiles, getYarnOrNPMCommand, scanScripts } = require('./utils/jsdetect')
module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', 'app.json'])) return false
  // REQUIRED DEPS
  if (!hasRequiredDeps(['expo'])) return false

  /** everything below now assumes that we are within expo */

  const possibleArgsArrs = scanScripts({
    // This script will run `expo start --web` in a new Expo project.
    // Note: Expo will automatically launch the browser with your app's
    // Webpack server listening on port 19006, but the instance proxied
    // by `netlify dev` will be running on port 8888.
    preferredScriptsArr: ['web'],
    preferredCommand: 'expo start --web',
  })

  return {
    framework: 'expo',
    command: getYarnOrNPMCommand(),
    frameworkPort: 19006,
    possibleArgsArrs,
    dist: 'web-build',
  }
}
