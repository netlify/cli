import { CommanderError } from 'commander'

import { injectForceFlagIfScripted } from './scripted-commands.js'
import { BaseCommand } from '../commands/index.js'
import { CI_FORCED_COMMANDS } from '../commands/main.js'
import { exit } from './command-helpers.js'

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
      exit(error.exitCode)
    }
    throw error
  }
}
