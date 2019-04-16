const { execSync } = require('child_process')

module.exports = function showHelp(command) {
  execSync(`netlify ${command} --help`, { stdio: [0, 1, 2] })
}
