export declare const getExecName: ({ execName }: {
    execName: any;
}) => any;
export declare const shouldFetchLatestVersion: ({ binPath, execArgs, execName, latestVersion, packageName, pattern, }: {
    binPath: any;
    execArgs: any;
    execName: any;
    latestVersion: any;
    packageName: any;
    pattern: any;
}) => Promise<boolean>;
export declare const getArch: () => "amd64" | "386" | "arm" | "arm64" | "mips" | "mipsel" | "ppc" | "ppc64" | "riscv64" | "s390" | "s390x";
/**
 * Tries to get the latest release from the github releases to download the binary.
 * Is throwing an error if there is no binary that matches the system os or arch
 * @param {object} config
 * @param {string} config.destination
 * @param {string} config.execName
 * @param {string} config.destination
 * @param {string} config.extension
 * @param {string} config.packageName
 * @param {string} [config.latestVersion ]
 */
export declare const fetchLatestVersion: ({ destination, execName, extension, latestVersion, packageName }: {
    destination: any;
    execName: any;
    extension: any;
    latestVersion: any;
    packageName: any;
}) => Promise<void>;
//# sourceMappingURL=exec-fetcher.d.ts.map