import { constants } from 'fs';
import { access, stat } from 'fs/promises';
const isErrnoException = (value) => value instanceof Error && Object.hasOwn(value, 'code');
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
 */
const isType = async (filePath, type) => {
    try {
        const stats = await stat(filePath);
        if (type === 'isFile')
            return stats.isFile();
        return stats.isDirectory();
    }
    catch (error) {
        if (isErrnoException(error) && error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
};
/**
 * Checks if the provided filePath is a file
 */
export const isFileAsync = async (filePath) => isType(filePath, 'isFile');
/**
 * Checks if the provided filePath is a directory
 */
export const isDirectoryAsync = async (filePath) => isType(filePath, 'isDirectory');
//# sourceMappingURL=fs.js.map