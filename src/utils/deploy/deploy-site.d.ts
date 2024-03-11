export declare const deploySite: (api: any, siteId: any, dir: any, { assetType, branch, concurrentHash, concurrentUpload, config, deployId, deployTimeout, draft, filter, fnDir, functionsConfig, hashAlgorithm, manifestPath, maxRetry, siteEnv, siteRoot, skipFunctionsCache, statusCb, syncFileLimit, tmpDir, workingDir, }?: {
    concurrentHash?: number | undefined;
    concurrentUpload?: number | undefined;
    deployTimeout?: number | undefined;
    draft?: boolean | undefined;
    maxRetry?: number | undefined;
    statusCb?: ((status: {
        type: string;
        msg: string;
        phase: string;
    }) => void) | undefined;
    syncFileLimit?: number | undefined;
    tmpDir?: string | undefined;
    fnDir?: string[] | undefined;
}) => Promise<{
    deployId: any;
    deploy: any;
    uploadList: any[];
}>;
//# sourceMappingURL=deploy-site.d.ts.map