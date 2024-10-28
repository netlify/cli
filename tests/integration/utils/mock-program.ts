import { createMainCommand } from '../../../src/commands/index.js'
import { injectForceFlagIfScripted } from '../../../src/utils/scripted-commands.js'

export const runMockProgram = async (argv) => {
  // inject the force flag if the command is a non-interactive shell or Ci enviroment
  const program = createMainCommand()

  const isValidCommand = program.commands.some((cmd) => cmd.name() === argv[2])

  if (isValidCommand) {
    injectForceFlagIfScripted(argv)
  }

  await program.parseAsync(argv)
}
