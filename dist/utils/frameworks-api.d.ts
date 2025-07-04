import type { NetlifyOptions } from '../commands/types.js';
interface FrameworksAPIPath {
    path: string;
    ensureExists: () => Promise<void>;
    exists: () => Promise<boolean>;
}
export type FrameworksAPIPaths = ReturnType<typeof getFrameworksAPIPaths>;
/**
 * Returns an object containing the paths for all the operations of the
 * Frameworks API. Each key maps to an object containing a `path` property with
 * the path of the operation, an `exists` method that returns whether the path
 * exists, and an `ensureExists` method that creates it in case it doesn't.
 */
export declare const getFrameworksAPIPaths: (basePath: string, packagePath?: string) => Record<"config" | "functions" | "blobs" | "root" | "edgeFunctions" | "edgeFunctionsImportMap", FrameworksAPIPath>;
/**
 * Merges a config object with any config options from the Frameworks API.
 */
export declare const getFrameworksAPIConfig: (config: NetlifyOptions["config"], frameworksAPIConfigPath: string) => Promise<import("./command-helpers.js").NormalizedCachedConfigConfig>;
export {};
//# sourceMappingURL=frameworks-api.d.ts.map