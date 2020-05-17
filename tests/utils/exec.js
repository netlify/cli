const { promisify } = require('util')
const { execFile: execSyncOriginal } = require('child_process')

const execFile = promisify(execSyncOriginal)

module.exports = (cmd, args, opts) => execFile(cmd, args, opts)
