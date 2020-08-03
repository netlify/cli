const { existsSync } = require('fs')

module.exports = function() {
  if (!existsSync('_config.yml')) {
    return false
  }

  return {
    framework: 'jekyll',
    frameworkPort: 4000,
    watchCommands: ['bundle exec jekyll serve -w'],
    dist: '_site',
  }
}
