declare const hashFns: (directories: any, { assetType, concurrentHash, functionsConfig, hashAlgorithm, manifestPath, rootDir, skipFunctionsCache, statusCb, tmpDir, }: {
    assetType?: string | undefined;
    concurrentHash: any;
    functionsConfig: any;
    hashAlgorithm?: string | undefined;
    manifestPath: any;
    rootDir: any;
    skipFunctionsCache: any;
    statusCb: any;
    tmpDir: any;
}) => Promise<{
    functions: {};
    functionsWithNativeModules: never[];
    shaMap: {};
    functionSchedules?: undefined;
    fnShaMap?: undefined;
    fnConfig?: undefined;
} | {
    functionSchedules: any;
    functions: {};
    functionsWithNativeModules: any;
    fnShaMap: {};
    fnConfig: any;
    shaMap?: undefined;
}>;
export default hashFns;
//# sourceMappingURL=hash-fns.d.ts.map