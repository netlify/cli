import { runProgram } from '../../../src/utils/run-program.js'
import { createMainCommand } from '../../../src/commands/index.js'

export const runMockProgram = async (argv) => {
  // inject the force flag if the command is a non-interactive shell or Ci enviroment
  const program = createMainCommand()

  await runProgram(program, argv)
}
