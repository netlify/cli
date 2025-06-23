import { type FSWatcher } from 'chokidar';
import { type NormalizedCachedConfigConfig } from './command-helpers.js';
import type { Rewriter } from './types.js';
export declare const onChanges: (files: string[], listener: () => unknown) => void;
export declare const getWatchers: () => FSWatcher[];
export declare const getLanguage: (headers: Record<string, string | string[] | undefined>) => string;
export declare const createRewriter: ({ config, configPath, distDir, geoCountry, jwtRoleClaim, jwtSecret, projectDir, }: {
    config: NormalizedCachedConfigConfig;
    configPath?: string | undefined;
    distDir?: string | undefined;
    geoCountry?: string | undefined;
    jwtRoleClaim: string;
    jwtSecret: string;
    projectDir: string;
}) => Promise<Rewriter>;
//# sourceMappingURL=rules-proxy.d.ts.map