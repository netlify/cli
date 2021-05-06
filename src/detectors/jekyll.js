const { existsSync } = require('fs')

const FRAMEWORK_PORT = 4000

module.exports = function detector() {
  if (!existsSync('_config.yml') && !existsSync('_config.yaml') && !existsSync('_config.toml')) {
    return false
  }

  return {
    framework: 'jekyll',
    frameworkPort: FRAMEWORK_PORT,
    command: 'bundle',
    possibleArgsArrs: [['exec', 'jekyll', 'serve', '-w']],
    dist: '_site',
  }
}
