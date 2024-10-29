import { injectForceFlagIfScripted } from './scripted-commands.js'
import { BaseCommand } from '../commands/index.js'
import { COMMANDS_WITH_FORCE } from '../commands/main.js'

// This function is used to run the program with the correct flags
export const runProgram = async (program: BaseCommand, argv: string[]) => {
  //if the command is not a valid command,
  const isValidForceCommand = COMMANDS_WITH_FORCE.has(argv[2])

  if (isValidForceCommand) {
    injectForceFlagIfScripted(argv)
  }

  await program.parseAsync(argv)
}
