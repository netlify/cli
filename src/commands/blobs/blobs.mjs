// @ts-check
import { chalk } from '../../utils/command-helpers.mjs'

import { createBlobsDeleteCommand } from './blobs-delete.mjs'
import { createBlobsGetCommand } from './blobs-get.mjs'
import { createBlobsListCommand } from './blobs-list.mjs'
import { createBlobsSetCommand } from './blobs-set.mjs'

/**
 * The functions command
 * @param {import('commander').OptionValues} options
 * @param {import('../base-command.mjs').default} command
 */
const blobs = (options, command) => {
  command.help()
}

/**
 * Creates the `netlify blobs` command
 * @param {import('../base-command.mjs').default} program
 * @returns
 */
export const createBlobsCommand = (program) => {
  createBlobsDeleteCommand(program)
  createBlobsGetCommand(program)
  createBlobsListCommand(program)
  createBlobsSetCommand(program)

  const name = chalk.greenBright('`blobs`')

  return program
    .command('blobs')
    .alias('function')
    .description(
      `Manage netlify blobs
The ${name} command will help you manage the blobs in this site`,
    )
    .addExamples([
      'netlify blobs:create --name function-xyz',
      'netlify blobs:build --blobs build/to/directory --src source/directory',
    ])
    .action(blobs)
}
