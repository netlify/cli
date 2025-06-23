import { stat } from 'fs/promises';
import { join } from 'path';
import { getPathInProject } from '../settings.js';
import { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } from './consts.js';
const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER]);
/**
 * @param {string} workingDir
 * @param {*} file
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'workingDir' implicitly has an 'any' typ... Remove this comment to see the full error message
export const deployFileNormalizer = (workingDir, file) => {
    const absoluteDistPath = join(workingDir, distPath);
    const isEdgeFunction = file.root === absoluteDistPath;
    const normalizedPath = isEdgeFunction ? `${PUBLIC_URL_PATH}/${file.normalizedPath}` : file.normalizedPath;
    return {
        ...file,
        normalizedPath,
    };
};
export const getDistPathIfExists = async (workingDir) => {
    try {
        const absoluteDistPath = join(workingDir, distPath);
        const stats = await stat(absoluteDistPath);
        if (!stats.isDirectory()) {
            throw new Error(`Path ${absoluteDistPath} must be a directory.`);
        }
        return absoluteDistPath;
    }
    catch {
        // no-op
    }
};
export const isEdgeFunctionFile = (filePath) => filePath.startsWith(`${PUBLIC_URL_PATH}/`);
//# sourceMappingURL=deploy.js.map