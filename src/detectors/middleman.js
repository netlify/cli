const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('config.rb')) {
    return false
  }

  return {
    framework: 'middleman',
    port: 8888,
    frameworkPort: 4567,
    env: { ...process.env },
    command: 'bundle',
    possibleArgsArrs: [['exec', 'middleman', 'server']],
    dist: 'build',
  }
}
