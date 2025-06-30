export type BuildCommandCache<T extends undefined | Record<string, unknown>> = Record<string, undefined | {
    enqueued?: true;
    task: Promise<T>;
    timestamp: number;
}>;
export declare const memoizedBuild: <T extends undefined | Record<string, unknown>>({ cache, cacheKey, command, }: {
    cache: BuildCommandCache<T>;
    cacheKey: string;
    command: () => Promise<T>;
}) => Promise<T>;
//# sourceMappingURL=memoized-build.d.ts.map