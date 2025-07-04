import type { NormalizedCachedConfigConfig } from '../command-helpers.js';
import type { Plugin } from '../types.js';
export declare const getRecommendPlugins: (frameworkPlugins: string[], config: NormalizedCachedConfigConfig) => string[];
export declare const getUIPlugins: (configPlugins: Plugin[]) => {
    package: string;
}[];
//# sourceMappingURL=plugins.d.ts.map