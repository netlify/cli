const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('config.toml') && !existsSync('config.yaml')) {
    return false
  }

  return {
    framework: 'hugo',
    frameworkPort: 1313,
    env: { ...process.env },
    command: 'hugo',
    possibleArgsArrs: [['server', '-w']],
    urlRegexp: new RegExp(`(http://)([^:]+:)${1313}(/)?`, 'g'),
    dist: 'public',
  }
}
