// @ts-check
const { BASE_FLAGS, createMainCommand } = require('../../src/commands')

const program = createMainCommand()

/** @type {Array<import('../../src/commands/base-command').BaseCommand>} */
// @ts-ignore typecast needed
const commands = program.commands.sort((cmdA, cmdB) => cmdA.name().localeCompare(cmdB.name()))

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
    .filter((option) => !option.hidden)
    .sort((optionA, optionB) => {
      // base flags should be always at the bottom
      if (BASE_FLAGS.has(optionA.long) || BASE_FLAGS.has(optionB.long)) {
        return -1
      }
      return optionA.long.localeCompare(optionB.long)
    })
    .reduce((prev, cur) => {
      const name = cur.long.replace('--', '')
      const contentType = cur.argChoices ? cur.argChoices.join(' | ') : 'string'

      return {
        ...prev,
        [name]: {
          description: cur.description,
          char: cur.short,
          type: cur.flags.includes('<') || cur.flags.includes('[') ? contentType : 'boolean',
        },
      }
    }, {})

  return {
    name: command.name(),
    description: command.description(),
    commands: commands
      // eslint-disable-next-line no-underscore-dangle
      .filter((cmd) => cmd.name().startsWith(`${command.name()}:`) && !cmd._hidden)
      .map((cmd) => parseCommand(cmd)),
    examples: command.examples.length !== 0 && command.examples,
    args: args.length !== 0 && args,
    flags: Object.keys(flags).length !== 0 && flags,
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
