const { existsSync } = require('fs')

module.exports = function detector() {
  if (!existsSync('config.toml') && !existsSync('config.yaml')) {
    return false
  }

  return {
    framework: 'hugo',
    frameworkPort: 1313,
    command: 'hugo',
    possibleArgsArrs: [['server', '-w']],
    dist: 'public',
  }
}
