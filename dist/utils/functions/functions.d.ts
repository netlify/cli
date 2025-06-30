import type { OptionValues } from 'commander';
import type { NormalizedCachedConfigConfig } from '../command-helpers.js';
export declare const INTERNAL_FUNCTIONS_FOLDER = "functions-internal";
export declare const SERVE_FUNCTIONS_FOLDER = "functions-serve";
/**
 * retrieves the function directory out of the flags or config
 */
export declare const getFunctionsDir: ({ config, options, }: {
    config: NormalizedCachedConfigConfig;
    options: OptionValues;
}, defaultValue?: string) => string | undefined;
export declare const getFunctionsManifestPath: ({ base, packagePath }: {
    base: string;
    packagePath?: string;
}) => Promise<string | null>;
export declare const getFunctionsDistPath: ({ base, packagePath, }: {
    base?: undefined | string;
    packagePath?: string;
}) => Promise<string | null>;
export declare const getFunctionsServePath: ({ base, packagePath, }: {
    base?: undefined | string;
    packagePath?: string;
}) => string;
/**
 * Retrieves the internal functions directory and creates it if ensureExists is provided
 */
export declare const getInternalFunctionsDir: ({ base, ensureExists, packagePath, }: {
    base?: undefined | string;
    ensureExists?: boolean;
    packagePath?: string;
}) => Promise<string>;
//# sourceMappingURL=functions.d.ts.map