import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import transform from 'parallel-transform';
import { normalizePath } from './util.js';
const hashFile = async (filePath, algorithm) => {
    const hasher = createHash(algorithm);
    await pipeline([createReadStream(filePath), hasher]);
    return hasher.digest('hex');
};
// a parallel transform stream segment ctor that hashes fileObj's created by folder-walker
// TODO: use promises instead of callbacks
// @ts-expect-error TS(7031) FIXME: Binding element 'concurrentHash' implicitly has an... Remove this comment to see the full error message
export const hasherCtor = ({ concurrentHash, hashAlgorithm }) => {
    if (!concurrentHash)
        throw new Error('Missing required opts');
    return transform(concurrentHash, { objectMode: true }, async (fileObj, cb) => {
        try {
            const hash = await hashFile(fileObj.filepath, hashAlgorithm);
            // insert hash and asset type to file obj
            cb(null, { ...fileObj, hash });
            return;
        }
        catch (error) {
            cb(error);
            return;
        }
    });
};
// Inject normalized file names into normalizedPath and assetType
export const fileNormalizerCtor = ({ assetType, normalizer: normalizeFunction, }) => {
    return new Transform({
        objectMode: true,
        transform(fileObj, _, callback) {
            const normalizedFile = { ...fileObj, assetType, normalizedPath: normalizePath(fileObj.relname) };
            const result = normalizeFunction !== undefined ? normalizeFunction(normalizedFile) : normalizedFile;
            this.push(result);
            callback();
        },
    });
};
// A writable stream segment ctor that normalizes file paths, and writes shaMap's
export const manifestCollectorCtor = (filesObj, shaMap, { statusCb }) => {
    return new Writable({
        objectMode: true,
        write(fileObj, _encoding, callback) {
            filesObj[fileObj.normalizedPath] = fileObj.hash;
            // Maintain hash to fileObj mapping
            if (Array.isArray(shaMap[fileObj.hash])) {
                shaMap[fileObj.hash].push(fileObj);
            }
            else {
                shaMap[fileObj.hash] = [fileObj];
            }
            statusCb({
                type: 'hashing',
                msg: `Hashing ${fileObj.relname}`,
                phase: 'progress',
            });
            callback();
        },
    });
};
export const fileFilterCtor = () => new Transform({
    objectMode: true,
    transform(fileObj, _, callback) {
        if (fileObj.type === 'file') {
            this.push(fileObj);
        }
        callback();
    },
});
//# sourceMappingURL=hasher-segments.js.map