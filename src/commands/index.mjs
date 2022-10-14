const baseCommand = require('./base-command.cjs')
const { createMainCommand } = require('./main.cjs')

module.exports = {
  ...baseCommand,
  createMainCommand,
}
