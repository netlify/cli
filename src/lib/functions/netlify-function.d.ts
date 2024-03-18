export default class NetlifyFunction {
    readonly name: string;
    readonly mainFile: string;
    readonly displayName: string;
    readonly schedule?: string;
    readonly runtime: string;
    private readonly directory;
    private readonly projectRoot;
    private readonly blobsContext;
    private readonly timeoutBackground;
    private readonly timeoutSynchronous;
    private readonly isBackground;
    private buildQueue?;
    private buildData?;
    buildError: Error | null;
    private readonly srcFiles;
    constructor({ blobsContext, config, directory, displayName, mainFile, name, projectRoot, runtime, settings, timeoutBackground, timeoutSynchronous, }: {
        blobsContext: any;
        config: any;
        directory: any;
        displayName: any;
        mainFile: any;
        name: any;
        projectRoot: any;
        runtime: any;
        settings: any;
        timeoutBackground: any;
        timeoutSynchronous: any;
    });
    get filename(): string | null;
    getRecommendedExtension(): ".mts" | ".mjs" | undefined;
    hasValidName(): boolean;
    isScheduled(): Promise<boolean>;
    isSupported(): boolean;
    isTypeScript(): boolean;
    getNextRun(): Promise<Date | null>;
    build({ cache }: {
        cache: any;
    }): Promise<{
        includedFiles: any;
        srcFilesDiff: {
            added: Set<string>;
            deleted: Set<string>;
        };
        error?: undefined;
    } | {
        error: unknown;
        includedFiles?: undefined;
        srcFilesDiff?: undefined;
    }>;
    getBuildData(): Promise<any>;
    getSrcFilesDiff(newSrcFiles: Set<string>): {
        added: Set<string>;
        deleted: Set<string>;
    };
    invoke(event?: {}, context?: {}): Promise<{
        result: any;
        error: null;
    } | {
        result: null;
        error: unknown;
    }>;
    /**
     * Matches all routes agains the incoming request. If a match is found, then the matched route is returned.
     * @returns matched route
     */
    matchURLPath(rawPath: string, method: string, hasStaticFile: () => Promise<boolean>): Promise<any>;
    get runtimeAPIVersion(): any;
    get url(): string;
}
//# sourceMappingURL=netlify-function.d.ts.map