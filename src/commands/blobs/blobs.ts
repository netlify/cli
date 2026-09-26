import terminalLink from 'terminal-link'

import requiresSiteInfo from '../../utils/hooks/requires-site-info.js'
import type BaseCommand from '../base-command.js'
import type {
  BlobsDeleteOptionValues,
  BlobsGetOptionValues,
  BlobsListOptionValues,
  BlobsOptionValues,
  BlobsSetOptionValues,
} from './option_values.js'

/**
 * The blobs command
 */
const blobs = (_options: BlobsOptionValues, command: BaseCommand) => {
  command.help()
}

/**
 * Creates the `netlify blobs` command
 */
export const createBlobsCommand = (program: BaseCommand) => {
  program
    .command('blobs:delete')
    .description(`Deletes an object with a given key, if it exists, from a Netlify Blobs store`)
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .option(
      '--region <region>',
      "The region where the store data is held, such as 'eu-central-1'; when omitted, the default region is used",
    )
    .alias('blob:delete')
    .hook('preAction', requiresSiteInfo)
    .action(async (storeName: string, key: string, _options: BlobsDeleteOptionValues, command: BaseCommand) => {
      const { blobsDelete } = await import('./blobs-delete.js')
      await blobsDelete(storeName, key, _options, command)
    })

  program
    .command('blobs:get')
    .description(
      `Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file`,
    )
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .option('-O, --output <path>', 'Defines the filesystem path where the blob data should be persisted')
    .option(
      '--region <region>',
      "The region where the store data is held, such as 'eu-central-1'; when omitted, the default region is used",
    )
    .alias('blob:get')
    .hook('preAction', requiresSiteInfo)
    .action(async (storeName: string, key: string, options: BlobsGetOptionValues, command: BaseCommand) => {
      const { blobsGet } = await import('./blobs-get.js')
      await blobsGet(storeName, key, options, command)
    })

  program
    .command('blobs:list')
    .description(`Lists objects in a Netlify Blobs store`)
    .argument('<store>', 'Name of the store')
    .option(
      '-d, --directories',
      `Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them`,
    )
    .option(
      '-p, --prefix <prefix>',
      `A string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned`,
    )
    .option('--json', 'Output list contents as JSON')
    .option(
      '--region <region>',
      "The region where the store data is held, such as 'eu-central-1'; when omitted, the default region is used",
    )
    .alias('blob:list')
    .hook('preAction', requiresSiteInfo)
    .action(async (storeName: string, options: BlobsListOptionValues, command: BaseCommand) => {
      const { blobsList } = await import('./blobs-list.js')
      await blobsList(storeName, options, command)
    })

  program
    .command('blobs:set')
    .description(
      `Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter`,
    )
    .argument('<store>', 'Name of the store')
    .argument('<key>', 'Object key')
    .argument('[value...]', 'Object value')
    .option('-i, --input <path>', 'Defines the filesystem path where the blob data should be read from')
    .option(
      '--region <region>',
      "The region where the store data is held, such as 'eu-central-1'; when omitted, the default region is used",
    )
    .alias('blob:set')
    .hook('preAction', requiresSiteInfo)

    .action(
      async (
        storeName: string,
        key: string,
        valueParts: string[],
        options: BlobsSetOptionValues,
        command: BaseCommand,
      ) => {
        const { blobsSet } = await import('./blobs-set.js')
        await blobsSet(storeName, key, valueParts, options, command)
      },
    )

  return program
    .command('blobs')
    .alias('blob')
    .description(`Manage objects in Netlify Blobs`)
    .addHelpText('after', () => {
      const docsUrl = 'https://docs.netlify.com/blobs/overview/'
      return `
For more information about Netlify Blobs, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`
    })
    .addExamples([
      'netlify blobs:get my-store my-key',
      'netlify blobs:set my-store my-key This will go in a blob',
      'netlify blobs:set my-store my-key --input ./some-file.txt',
      'netlify blobs:delete my-store my-key',
      'netlify blobs:list my-store',
      'netlify blobs:list my-store --json',
      'netlify blobs:list my-store --region eu-central-1',
    ])
    .action(blobs)
}
