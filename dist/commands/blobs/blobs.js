import terminalLink from 'terminal-link';
import requiresSiteInfo from '../../utils/hooks/requires-site-info.js';
/**
 * The blobs command
 */
const blobs = (_options, command) => {
    command.help();
};
/**
 * Creates the `netlify blobs` command
 */
export const createBlobsCommand = (program) => {
    program
        .command('blobs:delete')
        .description(`Deletes an object with a given key, if it exists, from a Netlify Blobs store`)
        .argument('<store>', 'Name of the store')
        .argument('<key>', 'Object key')
        .alias('blob:delete')
        .hook('preAction', requiresSiteInfo)
        .action(async (storeName, key, _options, command) => {
        const { blobsDelete } = await import('./blobs-delete.js');
        await blobsDelete(storeName, key, _options, command);
    });
    program
        .command('blobs:get')
        .description(`Reads an object with a given key from a Netlify Blobs store and, if it exists, prints the content to the terminal or saves it to a file`)
        .argument('<store>', 'Name of the store')
        .argument('<key>', 'Object key')
        .option('-O, --output <path>', 'Defines the filesystem path where the blob data should be persisted')
        .alias('blob:get')
        .hook('preAction', requiresSiteInfo)
        .action(async (storeName, key, options, command) => {
        const { blobsGet } = await import('./blobs-get.js');
        await blobsGet(storeName, key, options, command);
    });
    program
        .command('blobs:list')
        .description(`Lists objects in a Netlify Blobs store`)
        .argument('<store>', 'Name of the store')
        .option('-d, --directories', `Indicates that keys with the '/' character should be treated as directories, returning a list of sub-directories at a given level rather than all the keys inside them`)
        .option('-p, --prefix <prefix>', `A string for filtering down the entries; when specified, only the entries whose key starts with that prefix are returned`)
        .option('--json', 'Output list contents as JSON')
        .alias('blob:list')
        .hook('preAction', requiresSiteInfo)
        .action(async (storeName, options, command) => {
        const { blobsList } = await import('./blobs-list.js');
        await blobsList(storeName, options, command);
    });
    program
        .command('blobs:set')
        .description(`Writes to a Netlify Blobs store an object with the data provided in the command or the contents of a file defined by the 'input' parameter`)
        .argument('<store>', 'Name of the store')
        .argument('<key>', 'Object key')
        .argument('[value...]', 'Object value')
        .option('-i, --input <path>', 'Defines the filesystem path where the blob data should be read from')
        .alias('blob:set')
        .hook('preAction', requiresSiteInfo)
        .action(async (storeName, key, valueParts, options, command) => {
        const { blobsSet } = await import('./blobs-set.js');
        await blobsSet(storeName, key, valueParts, options, command);
    });
    return program
        .command('blobs')
        .alias('blob')
        .description(`Manage objects in Netlify Blobs`)
        .addHelpText('after', () => {
        const docsUrl = 'https://docs.netlify.com/blobs/overview/';
        return `
For more information about Netlify Blobs, see ${terminalLink(docsUrl, docsUrl, { fallback: false })}
`;
    })
        .addExamples([
        'netlify blobs:get my-store my-key',
        'netlify blobs:set my-store my-key This will go in a blob',
        'netlify blobs:set my-store my-key --input ./some-file.txt',
        'netlify blobs:delete my-store my-key',
        'netlify blobs:list my-store',
        'netlify blobs:list my-store --json',
    ])
        .action(blobs);
};
//# sourceMappingURL=blobs.js.map