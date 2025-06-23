import { promises as fs } from 'fs';
import { resolve } from 'path';
import { isDirectoryAsync, isFileAsync } from '../../lib/fs.js';
import { getPathInProject } from '../../lib/settings.js';
export const INTERNAL_FUNCTIONS_FOLDER = 'functions-internal';
export const SERVE_FUNCTIONS_FOLDER = 'functions-serve';
const isNonEmptyString = (s) => typeof s === 'string' && s.length > 0;
/**
 * retrieves the function directory out of the flags or config
 */
export const getFunctionsDir = ({ config, options, }, defaultValue) => ('functions' in options && isNonEmptyString(options.functions) ? options.functions : null) ??
    (isNonEmptyString(config.dev?.functions) ? config.dev.functions : null) ??
    (isNonEmptyString(config.functionsDirectory) ? config.functionsDirectory : null) ??
    defaultValue;
export const getFunctionsManifestPath = async ({ base, packagePath = '' }) => {
    const path = resolve(base, packagePath, getPathInProject(['functions', 'manifest.json']));
    const isFile = await isFileAsync(path);
    return isFile ? path : null;
};
export const getFunctionsDistPath = async ({ base, packagePath = '', }) => {
    const path = resolve(base ?? '', packagePath, getPathInProject(['functions']));
    const isDirectory = await isDirectoryAsync(path);
    return isDirectory ? path : null;
};
export const getFunctionsServePath = ({ base, packagePath = '', }) => {
    const path = resolve(base ?? '', packagePath, getPathInProject([SERVE_FUNCTIONS_FOLDER]));
    return path;
};
/**
 * Retrieves the internal functions directory and creates it if ensureExists is provided
 */
export const getInternalFunctionsDir = async ({ base, ensureExists, packagePath = '', }) => {
    const path = resolve(base ?? '', packagePath, getPathInProject([INTERNAL_FUNCTIONS_FOLDER]));
    if (ensureExists) {
        await fs.mkdir(path, { recursive: true });
    }
    return path;
};
//# sourceMappingURL=functions.js.map