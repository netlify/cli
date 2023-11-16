import { OptionValues } from 'commander'

import requiresSiteInfo from '../../utils/hooks/requires-site-info.mjs'
import BaseCommand from '../base-command.mjs'

import { createBlobsGetCommand } from './blobs-get.mjs'
import { createBlobsListCommand } from './blobs-list.mjs'
import { createBlobsSetCommand } from './blobs-set.mjs'

/**
 * The blobs command
 */
const blobs = (_options: OptionValues, command: BaseCommand) => {
  command.help()
}

/**
 * Creates the `netlify blobs` command
 */
export const createBlobsCommand = (program: BaseCommand) => {
  program
    .command('blobs:delete')
    .description(`(Beta) Deletes an object with a given key, if it exists, from a Netlify Blobs store`)
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .alias('blob:delete')
    .hook('preAction', requiresSiteInfo)
    .action(async (storeName: string, key: string, _options: OptionValues, command: BaseCommand) => {
      const { blobsDelete } = await import('./blobs-delete.mjs')
      await blobsDelete(storeName, key, _options, command)
    })
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
