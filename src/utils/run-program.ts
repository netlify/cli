import { injectForceFlagIfScripted } from './scripted-commands.js'
import { BaseCommand } from '../commands/index.js'
import { CI_FORCED_COMMANDS } from '../commands/main.js'

// This function is used to run the program with the correct flags
export const runProgram = async (program: BaseCommand, argv: string[]) => {
  const cmdName = argv[2]
  // checks if the command has a force option
  const isValidForceCommand = cmdName in CI_FORCED_COMMANDS

  if (isValidForceCommand) {
    injectForceFlagIfScripted(argv)
  }

  await program.parseAsync(argv)
}
