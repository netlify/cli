const path = require('path')

// Quoted so that commands work in paths with spaces
const cliPath = '"' + path.join(__dirname, '..', '..', '..', 'bin/run') + '"'

module.exports = cliPath
