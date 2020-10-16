const { hasRequiredDeps, hasRequiredFiles } = require('./utils/jsdetect')

const FRAMEWORK_PORT = 8080

module.exports = function detector() {
  // REQUIRED FILES
  if (
    !hasRequiredFiles(['package.json', '.eleventy.js']) &&
    !(hasRequiredFiles(['package.json']) && hasRequiredDeps(['@11ty/eleventy']))
  )
    return false

  return {
    framework: 'eleventy',
    frameworkPort: FRAMEWORK_PORT,
    command: 'npx',
    possibleArgsArrs: [['eleventy', '--serve', '--watch']],
    dist: '_site',
  }
}
