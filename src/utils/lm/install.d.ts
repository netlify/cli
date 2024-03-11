export declare const installPlatform: ({ force }: {
    force: any;
}) => Promise<boolean>;
export declare const isBinInPath: () => boolean;
export declare const getShellInfo: () => {
    shell: string | undefined;
    incFilePath: string;
    configFile: any;
};
export declare const uninstall: () => Promise<void>;
//# sourceMappingURL=install.d.ts.map