export declare const getExecName: ({ execName }: {
    execName: string;
}) => string;
export declare const shouldFetchLatestVersion: ({ binPath, execArgs, execName, latestVersion, packageName, pattern, }: {
    binPath: string;
    execArgs: string[];
    execName: string;
    latestVersion?: string | undefined;
    packageName: string;
    pattern: string;
}) => Promise<boolean>;
export declare const getArch: () => "amd64" | "386" | "arm" | "arm64" | "mips" | "mipsel" | "ppc" | "ppc64" | "s390" | "s390x";
export declare const fetchLatestVersion: ({ destination, execName, extension, latestVersion, packageName, }: {
    destination: string;
    execName: string;
    extension: string;
    latestVersion?: string | undefined;
    packageName: string;
}) => Promise<void>;
//# sourceMappingURL=exec-fetcher.d.ts.map