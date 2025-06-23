import type { NetlifyConfig } from '@netlify/build';
import type { NodeBundlerName } from '@netlify/zip-it-and-ship-it';
export interface NormalizedFunctionConfigObject {
    externalNodeModules?: undefined | string[];
    includedFiles?: undefined | string[];
    includedFilesBasePath: string;
    ignoredNodeModules?: undefined | string[];
    nodeBundler?: undefined | NodeBundlerName;
    nodeVersion?: undefined | string;
    processDynamicNodeImports: true;
    zipGo: true;
    schedule?: undefined | string;
}
export type NormalizedFunctionsConfig = {
    '*': NormalizedFunctionConfigObject;
    [pattern: string]: NormalizedFunctionConfigObject;
};
export declare const normalizeFunctionsConfig: ({ functionsConfig, projectRoot, siteEnv, }: {
    functionsConfig?: NetlifyConfig["functions"];
    projectRoot: string;
    siteEnv?: Record<string, undefined | string>;
}) => NormalizedFunctionsConfig;
//# sourceMappingURL=config.d.ts.map