const { existsSync } = require('fs')

module.exports = function detector() {
  if (!existsSync('_config.yml')) {
    return false
  }

  return {
    framework: 'jekyll',
    frameworkPort: 4000,
    command: 'bundle',
    possibleArgsArrs: [['exec', 'jekyll', 'serve', '-w']],
    dist: '_site',
  }
}
