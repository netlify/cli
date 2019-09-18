const {
  // hasRequiredDeps,
  hasRequiredFiles
  // scanScripts
} = require('./utils/jsdetect')

module.exports = function() {
  // REQUIRED FILES
  if (!hasRequiredFiles(['package.json', '.eleventy.js'])) return false
  // commented this out because we're not sure if we want to require it
  // // REQUIRED DEPS
  // if (!hasRequiredDeps(["@11y/eleventy"])) return false;

  return {
    type: 'eleventy',
    port: 8888,
    proxyPort: 8080,
    env: { ...process.env },
    command: 'npx',
    possibleArgsArrs: [['eleventy', '--serve', '--watch']],
    urlRegexp: new RegExp(`(http://)([^:]+:)${8080}(/)?`, 'g'),
    dist: '_site'
  }
}
