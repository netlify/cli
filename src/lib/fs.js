import { constants } from 'fs';
import { access, stat } from 'fs/promises';
// @ts-expect-error TS(7006) FIXME: Parameter 'filePath' implicitly has an 'any' type.
export const fileExistsAsync = async (filePath) => {
    try {
        await access(filePath, constants.F_OK);
        return true;
    }
    catch {
        return false;
    }
};
/**
 * calls stat async with a function and catches potential errors
 * @param {string} filePath
 * @param {keyof import('fs').StatsBase<number>} type For example `isDirectory` or `isFile`
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'filePath' implicitly has an 'any' type.
const isType = async (filePath, type) => {
    try {
        const stats = await stat(filePath);
        // @ts-expect-error TS(7053) FIXME: Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        return typeof stats[type] === 'function' ? stats[type]() : stats[type];
    }
    catch (error_) {
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        if (error_.code === 'ENOENT') {
            return false;
        }
        throw error_;
    }
};
/**
 * Checks if the provided filePath is a file
 * @param {string} filePath
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'filePath' implicitly has an 'any' type.
export const isFileAsync = (filePath) => isType(filePath, 'isFile');
/**
 * Checks if the provided filePath is a directory
 * @param {string} filePath
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'filePath' implicitly has an 'any' type.
export const isDirectoryAsync = (filePath) => isType(filePath, 'isDirectory');
