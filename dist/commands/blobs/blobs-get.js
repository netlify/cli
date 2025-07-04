import { promises as fs } from 'fs';
import { resolve } from 'path';
import { getStore } from '@netlify/blobs';
import { chalk, logAndThrowError } from '../../utils/command-helpers.js';
export const blobsGet = async (storeName, key, options, command) => {
    const { api, siteInfo } = command.netlify;
    const { output } = options;
    const store = getStore({
        apiURL: `${api.scheme}://${api.host}`,
        name: storeName,
        siteID: siteInfo?.id ?? '',
        token: api.accessToken ?? '',
    });
    let blob;
    try {
        blob = await store.get(key);
    }
    catch {
        return logAndThrowError(`Could not retrieve blob ${chalk.yellow(key)} from store ${chalk.yellow(storeName)}`);
    }
    if (blob === null) {
        return logAndThrowError(`Blob ${chalk.yellow(key)} does not exist in store ${chalk.yellow(storeName)}`);
    }
    if (output) {
        const path = resolve(output);
        await fs.writeFile(path, blob);
    }
    else {
        console.log(blob);
    }
};
//# sourceMappingURL=blobs-get.js.map