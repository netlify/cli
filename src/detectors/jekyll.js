const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('_config.yml')) {
    return false
  }

  return {
    framework: 'jekyll',
    port: 8888,
    proxyPort: 4000,
    env: { ...process.env },
    command: 'bundle',
    possibleArgsArrs: [['exec', 'jekyll', 'serve', '-w']],
    urlRegexp: new RegExp(`(http://)([^:]+:)${4000}(/)?`, 'g'),
    dist: '_site'
  }
}
