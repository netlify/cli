const { existsSync } = require('fs')

const FRAMEWORK_PORT = 1313

module.exports = function detector() {
  if (!existsSync('config.toml') && !existsSync('config.yaml')) {
    return false
  }

  return {
    framework: 'hugo',
    frameworkPort: FRAMEWORK_PORT,
    command: 'hugo',
    possibleArgsArrs: [['server', '-w']],
    dist: 'public',
  }
}
