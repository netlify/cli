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
    port: 8888,
    frameworkPort: 8080,
    env: { ...process.env },
    command: 'npx',
    possibleArgsArrs: [['eleventy', '--serve', '--watch']],
    urlRegexp: new RegExp(`(http://)([^:]+:)${8080}(/)?`, 'g'),
    dist: '_site',
  }
}
