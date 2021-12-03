// @ts-check
const { createMainCommand } = require('../../src/commands')
const { OPTION_HIDDEN_DESCRIPTION } = require('../../src/commands/base-command')

const program = createMainCommand()

const { commands } = program
/**
 *
 * @param {import('../../src/commands/base-command').BaseCommand} command
 */
const parseCommand = function (command) {
  // eslint-disable-next-line no-underscore-dangle
  const args = command._args.map(({ _name: name, description }) => ({
    name,
    description,
  }))

  const flags = command.options
    .filter((option) => !option.description.includes(OPTION_HIDDEN_DESCRIPTION))
    .reduce((prev, cur) => {
      // console.log(option)
      const name = cur.long.replace('--', '')
      return {
        ...prev,
        [name]: {
          description: cur.description,
          char: cur.short,
        },
      }
    }, {})

  return {
    name: command.name(),
    description: command.description(),
    commands: commands
      // eslint-disable-next-line no-underscore-dangle
      .filter((cmd) => cmd.name().startsWith(`${command.name()}:` && !command._hidden))
      .map((cmd) => parseCommand(cmd)),
    examples: command.examples,
    args: args.length !== 0 && args,
    flags,
  }
}

const generateCommandData = function () {
  return (
    commands
      // filter out sub commands
      // eslint-disable-next-line no-underscore-dangle
      .filter((command) => !command.name().includes(':') && !command._hidden)
      .reduce((prev, command) => ({ ...prev, [command.name()]: parseCommand(command) }), {})
  )
}

module.exports = { generateCommandData }
