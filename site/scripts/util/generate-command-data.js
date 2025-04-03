import { createMainCommand } from '../../../src/commands/index.js'
import { sortOptions } from '../../../src/utils/command-helpers.js'

const program = createMainCommand()

/** @type {Array<import('../../../src/commands/base-command.js').default>} */
// @ts-ignore typecast needed
const commands = program.commands.sort((cmdA, cmdB) => cmdA.name().localeCompare(cmdB.name()))

/**
 * @param {import('../../../src/commands/base-command.js').default} command
 */
const parseCommand = function(command) {
  const args = command._args.map(({ _name: name, description }) => ({
    name,
    description,
  }))

  const flags = command.options
    .filter((option) => !option.hidden)
    .sort(sortOptions)
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
      .filter((cmd) => cmd.name().startsWith(`${command.name()}:`) && !cmd._hidden)
      .map((cmd) => parseCommand(cmd)),
    examples: command.examples.length !== 0 && command.examples,
    args: args.length !== 0 && args,
    flags: Object.keys(flags).length !== 0 && flags,
  }
}

export const generateCommandData = function() {
  return (
    commands
      // filter out sub commands

      .filter((command) => !command.name().includes(':') && !command._hidden)
      .reduce((prev, command) => ({ ...prev, [command.name()]: parseCommand(command) }), {})
  )
}
