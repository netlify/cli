import { createEnvCloneCommand } from './env-clone.js'
import { createEnvGetCommand } from './env-get.js'
import { createEnvImportCommand } from './env-import.js'
import { createEnvListCommand } from './env-list.js'
import { createEnvSetCommand } from './env-set.js'
import { createEnvUnsetCommand } from './env-unset.js'

/**
 * The env command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.js').default} command
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'options' implicitly has an 'any' type.
const env = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify env` command
 * @param {import('../base-command.js').default} program
 * @returns
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'program' implicitly has an 'any' type.
export const createEnvCommand = (program) => {
  createEnvGetCommand(program)
  createEnvImportCommand(program)
  createEnvListCommand(program)
  createEnvSetCommand(program)
  createEnvUnsetCommand(program)
  createEnvCloneCommand(program)

  return program
    .command('env')
    .description('Control environment variables for the current site')
    .addExamples([
      'netlify env:list',
      'netlify env:get VAR_NAME',
      'netlify env:set VAR_NAME value',
      'netlify env:unset VAR_NAME',
      'netlify env:import fileName',
      'netlify env:clone --to <to-site-id>',
    ])
    .action(env)
}
