const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('config.rb')) {
    return false
  }

  return {
    framework: 'middleman',
    frameworkPort: 4567,
    watchCommands: ['bundle exec middleman server'],
    dist: 'build',
  }
}
