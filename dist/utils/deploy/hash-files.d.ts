import { $TSFixMe } from '../../commands/types.js';
declare const hashFiles: ({ assetType, concurrentHash, directories, filter, hashAlgorithm, normalizer, statusCb, }: {
    assetType?: string | undefined;
    concurrentHash: $TSFixMe;
    directories: $TSFixMe;
    filter: $TSFixMe;
    hashAlgorithm?: string | undefined;
    normalizer?: $TSFixMe;
    statusCb: $TSFixMe;
}) => Promise<{
    files: Record<string, string>;
    filesShaMap: Record<string, $TSFixMe[]>;
}>;
export default hashFiles;
//# sourceMappingURL=hash-files.d.ts.map