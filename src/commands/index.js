const baseCommand = require('./base-command')
const { createMainCommand } = require('./main')

module.exports = {
  ...baseCommand,
  createMainCommand,
}
