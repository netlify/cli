declare const hashFiles: ({ assetType, concurrentHash, directories, filter, hashAlgorithm, normalizer, statusCb, }: {
    assetType?: string | undefined;
    concurrentHash: any;
    directories: any;
    filter: any;
    hashAlgorithm?: string | undefined;
    normalizer: any;
    statusCb: any;
}) => Promise<{
    files: {};
    filesShaMap: {};
}>;
export default hashFiles;
//# sourceMappingURL=hash-files.d.ts.map