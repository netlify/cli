// @ts-check
import { createBlobsDeleteCommand } from './blobs-delete.mjs'
import { createBlobsGetCommand } from './blobs-get.mjs'
import { createBlobsListCommand } from './blobs-list.mjs'
import { createBlobsSetCommand } from './blobs-set.mjs'

/**
 * The blobs command
 * @param {import('commander').OptionValues} _options
 * @param {import('../base-command.mjs').default} command
 */
const blobs = (_options, command) => {
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

  return program
    .command('blobs')
    .alias('blob')
    .description(`(Beta) Manage objects in Netlify Blobs`)
    .addExamples([
      'netlify blobs:get my-store my-key',
      'netlify blobs:set my-store my-key This will go in a blob',
      'netlify blobs:set my-store my-key --input ./some-file.txt',
      'netlify blobs:delete my-store my-key',
      'netlify blobs:list my-store',
      'netlify blobs:list my-store --json',
    ])
    .action(blobs)
}
