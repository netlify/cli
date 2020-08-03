const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('config.toml') && !existsSync('config.yaml')) {
    return false
  }

  return {
    framework: 'hugo',
    frameworkPort: 1313,
    watchCommands: ['hugo server -w'],
    dist: 'public',
  }
}
