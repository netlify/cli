import { CommanderError, type HelpContext } from 'commander'

import { log } from './command-helpers.js'
import { isInteractive } from './scripted-commands.js'

const OPTION_ERROR_CODES = new Set([
  'commander.unknownOption',
  'commander.missingArgument',
  'commander.excessArguments',
])

/** Every Commander error code caused by bad user input; these exit with `EXIT_CODES.USAGE_ERROR` */
export const USAGE_ERROR_CODES = new Set([
  ...OPTION_ERROR_CODES,
  'commander.unknownCommand',
  'commander.optionMissingArgument',
  'commander.missingMandatoryOptionValue',
  'commander.invalidArgument',
  'commander.conflictingOption',
])

export const isOptionError = (error: CommanderError): boolean => OPTION_ERROR_CODES.has(error.code)

export const handleOptionError = (command: { outputHelp: (context?: HelpContext) => void }): void => {
  if (!isInteractive()) {
    log()
    command.outputHelp({ error: true })
    log()
  }
}
