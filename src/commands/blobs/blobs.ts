import { createBlobsDeleteCommand } from './blobs-delete.js'
import { createBlobsGetCommand } from './blobs-get.js'
import { createBlobsListCommand } from './blobs-list.js'
import { createBlobsSetCommand } from './blobs-set.js'

/**
 * The blobs command
 */
const blobs = (_options: Record<string, unknown>, command: any) => {
  command.help()
}

/**
 * Creates the `netlify blobs` command
 */
export const createBlobsCommand = (program: any) => {
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
