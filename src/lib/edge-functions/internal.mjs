import { readFile, stat } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { getPathInProject } from '../settings.mjs';
import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.mjs';
/**
 * @param {string} workingDir
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
export const getInternalFunctions = async (workingDir) => {
    const path = join(workingDir, getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]));
    try {
        const stats = await stat(path);
        if (!stats.isDirectory()) {
            throw new Error('Internal edge functions directory expected');
        }
    }
    catch {
        return {
            functions: [],
            path: null,
        };
    }
    try {
        const manifestPath = join(path, 'manifest.json');
        // @ts-expect-error TS(2345) FIXME: Argument of type 'Buffer' is not assignable to par... Remove this comment to see the full error message
        const manifest = JSON.parse(await readFile(manifestPath));
        if (manifest.version !== 1) {
            throw new Error('Unsupported manifest format');
        }
        const data = {
            functions: manifest.functions || [],
            path,
        };
        if (manifest.import_map) {
            // @ts-expect-error TS(2339) FIXME: Property 'importMap' does not exist on type '{ fun... Remove this comment to see the full error message
            data.importMap = resolve(dirname(manifestPath), manifest.import_map);
        }
        return data;
    }
    catch {
        return {
            functions: [],
            path,
        };
    }
};
