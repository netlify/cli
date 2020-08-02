const { hasRequiredDeps, hasRequiredFiles } = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (
    !hasRequiredFiles(['package.json', '.eleventy.js']) &&
    !(hasRequiredFiles(['package.json']) && hasRequiredDeps(['@11ty/eleventy']))
  )
    return false

  return {
    framework: 'eleventy',
    frameworkPort: 8080,
    command: 'npx',
    possibleArgsArrs: [['eleventy', '--serve', '--watch']],
    dist: '_site',
  }
}
