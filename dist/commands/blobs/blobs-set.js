import { promises as fs } from 'fs';
import { resolve } from 'path';
import { getStore } from '@netlify/blobs';
import { chalk, logAndThrowError, isNodeError, log } from '../../utils/command-helpers.js';
import { promptBlobSetOverwrite } from '../../utils/prompts/blob-set-prompt.js';
export const blobsSet = async (storeName, key, valueParts, options, command) => {
    const { api, siteInfo } = command.netlify;
    const { force, input } = options;
    const store = getStore({
        apiURL: `${api.scheme}://${api.host}`,
        name: storeName,
        siteID: siteInfo.id,
        token: api.accessToken ?? '',
    });
    let value = valueParts.join(' ');
    if (input) {
        const inputPath = resolve(input);
        try {
            value = await fs.readFile(inputPath, 'utf8');
        }
        catch (error) {
            if (isNodeError(error) && error.code === 'ENOENT') {
                return logAndThrowError(`Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`);
            }
            if (isNodeError(error) && error.code === 'EISDIR') {
                return logAndThrowError(`Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} is a directory`);
            }
            return logAndThrowError(`Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} could not be read`);
        }
    }
    else if (!value) {
        return logAndThrowError(`You must provide a value as a command-line parameter (e.g. 'netlify blobs:set my-store my-key my value') or specify the path to a file from where the value should be read (e.g. 'netlify blobs:set my-store my-key --input ./my-file.txt')`);
    }
    if (force === undefined) {
        const existingValue = await store.get(key);
        if (existingValue) {
            await promptBlobSetOverwrite(key, storeName);
        }
    }
    try {
        await store.set(key, value);
        log(`${chalk.greenBright('Success')}: Blob ${chalk.yellow(key)} set in store ${chalk.yellow(storeName)}`);
    }
    catch {
        return logAndThrowError(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`);
    }
};
//# sourceMappingURL=blobs-set.js.map