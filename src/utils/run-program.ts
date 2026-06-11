import { CommanderError } from 'commander'

import { injectForceFlagIfScripted } from './scripted-commands.js'
import { BaseCommand } from '../commands/index.js'
import { CI_FORCED_COMMANDS } from '../commands/main.js'
import { exit } from './command-helpers.js'
import { EXIT_CODES } from './exit-codes.js'

const USAGE_ERROR_CODES = new Set(['commander.unknownCommand', 'commander.unknownOption'])

export const runProgram = async (program: BaseCommand, argv: string[]) => {
  const cmdName = argv[2]
  // checks if the command has a force option
  const isValidForceCommand = cmdName in CI_FORCED_COMMANDS

  if (isValidForceCommand) {
    injectForceFlagIfScripted(argv)
  }

  try {
    await program.parseAsync(argv)
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.exitCode !== 0 && USAGE_ERROR_CODES.has(error.code)) {
        exit(EXIT_CODES.USAGE_ERROR)
      }
      exit(error.exitCode)
    }
    throw error
  }
}
