/**
 * @param {object} params
 * @param {unknown} params.config
 * @param {string} params.mainFile
 * @param {string} params.projectRoot
 */
export declare const parseFunctionForMetadata: ({ config, mainFile, projectRoot }: {
    config: any;
    mainFile: any;
    projectRoot: any;
}) => Promise<import("@netlify/zip-it-and-ship-it").ListedFunction | undefined>;
/**
 *
 * @param {object} param0
 * @param {*} param0.config
 * @param {*} param0.directory
 * @param {*} param0.errorExit
 * @param {*} param0.func
 * @param {*} param0.metadata
 * @param {string} param0.projectRoot
 */
export default function handler({ config, directory, errorExit, func, metadata, projectRoot }: {
    config: any;
    directory: any;
    errorExit: any;
    func: any;
    metadata: any;
    projectRoot: any;
}): Promise<false | {
    build: ({ cache }: {
        cache?: {} | undefined;
    }) => Promise<{
        buildPath: string;
        includedFiles: any;
        outputModuleFormat: any;
        mainFile: any;
        routes: any;
        runtimeAPIVersion: any;
        srcFiles: any;
        schedule: any;
    }>;
    builderName: string;
    target: string;
}>;
//# sourceMappingURL=zisi.d.ts.map