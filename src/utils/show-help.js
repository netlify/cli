const { execSync } = require('child_process')

const showHelp = (command) => {
  execSync(`netlify ${command} --help`, { stdio: [0, 1, 2] })
}

module.exports = { showHelp }
