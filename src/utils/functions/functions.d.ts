export declare const INTERNAL_FUNCTIONS_FOLDER = "functions-internal";
export declare const SERVE_FUNCTIONS_FOLDER = "functions-serve";
/**
 * retrieves the function directory out of the flags or config
 * @param {object} param
 * @param {object} param.config
 * @param {import('commander').OptionValues} param.options The options from the commander
 * @param {string} [defaultValue]
 * @returns {string}
 */
export declare const getFunctionsDir: ({ config, options }: {
    config: any;
    options: any;
}, defaultValue: any) => any;
export declare const getFunctionsManifestPath: ({ base, packagePath }: {
    base: any;
    packagePath?: string | undefined;
}) => Promise<string | null>;
export declare const getFunctionsDistPath: ({ base, packagePath }: {
    base: any;
    packagePath?: string | undefined;
}) => Promise<string | null>;
export declare const getFunctionsServePath: ({ base, packagePath }: {
    base: any;
    packagePath?: string | undefined;
}) => string;
/**
 * Retrieves the internal functions directory and creates it if ensureExists is provided
 */
export declare const getInternalFunctionsDir: ({ base, ensureExists, packagePath, }: {
    base: string;
    ensureExists?: boolean | undefined;
    packagePath?: string | undefined;
}) => Promise<string>;
//# sourceMappingURL=functions.d.ts.map