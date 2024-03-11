import { readFile } from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { isFileAsync } from '../lib/fs.js';
import { warn } from './command-helpers.js';
// @ts-expect-error TS(7031) FIXME: Binding element 'envFiles' implicitly has an 'any'... Remove this comment to see the full error message
export const loadDotEnvFiles = async function ({ envFiles, projectDir }) {
    const response = await tryLoadDotEnvFiles({ projectDir, dotenvFiles: envFiles });
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    const filesWithWarning = response.filter((el) => el.warning);
    filesWithWarning.forEach((el) => {
        // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
        warn(el.warning);
    });
    // @ts-expect-error TS(2532) FIXME: Object is possibly 'undefined'.
    return response.filter((el) => el.file && el.env);
};
// in the user configuration, the order is highest to lowest
const defaultEnvFiles = ['.env.development.local', '.env.local', '.env.development', '.env'];
// @ts-expect-error TS(7031) FIXME: Binding element 'projectDir' implicitly has an 'an... Remove this comment to see the full error message
export const tryLoadDotEnvFiles = async ({ dotenvFiles = defaultEnvFiles, projectDir }) => {
    const results = await Promise.all(dotenvFiles.map(async (file) => {
        const filepath = path.resolve(projectDir, file);
        try {
            const isFile = await isFileAsync(filepath);
            if (!isFile) {
                return;
            }
        }
        catch (error) {
            return {
                // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
                warning: `Failed reading env variables from file: ${filepath}: ${error.message}`,
            };
        }
        const content = await readFile(filepath, 'utf-8');
        const env = dotenv.parse(content);
        return { file, env };
    }));
    // we return in order of lowest to highest priority
    return results.filter(Boolean).reverse();
};
