const path = require('path')

const cliPath = path.resolve(__dirname, '..', '..', 'bin', process.platform === 'win32' ? 'run.cmd' : 'run')

module.exports = cliPath
