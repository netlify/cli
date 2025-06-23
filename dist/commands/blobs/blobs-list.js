import { getStore } from '@netlify/blobs';
import AsciiTable from 'ascii-table';
import { chalk, logAndThrowError, log, logJson } from '../../utils/command-helpers.js';
export const blobsList = async (storeName, options, command) => {
    const { api, siteInfo } = command.netlify;
    const store = getStore({
        apiURL: `${api.scheme}://${api.host}`,
        name: storeName,
        siteID: siteInfo.id,
        token: api.accessToken ?? '',
    });
    try {
        const { blobs, directories } = await store.list({
            directories: Boolean(options.directories),
            prefix: options.prefix,
        });
        if (options.json) {
            logJson({ blobs, directories });
            return;
        }
        if (blobs.length === 0 && directories.length === 0) {
            log(`Netlify Blobs store ${chalk.yellow(storeName)} is empty`);
            return;
        }
        const table = new AsciiTable(`Netlify Blobs (${storeName})`);
        table.setHeading('Key', 'ETag');
        directories.forEach((directory) => {
            table.addRow(directory, '(directory)');
        });
        blobs.forEach((blob) => {
            table.addRow(blob.key, blob.etag);
        });
        log(table.toString());
    }
    catch {
        return logAndThrowError(`Could not list blobs from store ${chalk.yellow(storeName)}`);
    }
};
//# sourceMappingURL=blobs-list.js.map