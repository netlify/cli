import { promises as fs } from 'fs';
import { resolve } from 'path';
import { getStore } from '@netlify/blobs';
import { chalk, error as printError, isNodeError } from '../../utils/command-helpers.js';
export const blobsSet = async (storeName, key, valueParts, options, command) => {
    const { api, siteInfo } = command.netlify;
    const { input } = options;
    const store = getStore({
        apiURL: `${api.scheme}://${api.host}`,
        name: storeName,
        siteID: siteInfo.id ?? '',
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
                return printError(`Could not set blob ${chalk.yellow(key)} because the file ${chalk.underline(inputPath)} does not exist`);
            }
            if (isNodeError(error) && error.code === 'EISDIR') {
                return printError(`Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} is a directory`);
            }
            return printError(`Could not set blob ${chalk.yellow(key)} because the path ${chalk.underline(inputPath)} could not be read`);
        }
    }
    else if (!value) {
        return printError(`You must provide a value as a command-line parameter (e.g. 'netlify blobs:set my-store my-key my value') or specify the path to a file from where the value should be read (e.g. 'netlify blobs:set my-store my-key --input ./my-file.txt')`);
    }
    try {
        await store.set(key, value);
    }
    catch {
        return printError(`Could not set blob ${chalk.yellow(key)} in store ${chalk.yellow(storeName)}`);
    }
};
