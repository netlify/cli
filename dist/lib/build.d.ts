import build, { type NetlifyConfig, type OnPostBuild } from '@netlify/build';
import type { MinimalHeader } from '@netlify/headers-parser';
import type { OptionValues } from 'commander';
import type { MinimalAccount, EnvironmentVariables, Plugin, SiteInfo } from '../utils/types.js';
import type { EdgeFunctionDeclaration } from './edge-functions/proxy.js';
export interface CachedConfig {
    accounts: MinimalAccount[] | undefined;
    buildDir: string;
    env: EnvironmentVariables;
    repositoryRoot: string;
    siteInfo: SiteInfo;
    api?: unknown;
    branch?: unknown;
    config: {
        build: {
            base: string;
            command?: string | undefined;
            functions?: string | undefined;
            functionsSource?: string | undefined;
            edge_functions?: string | undefined;
            environment: Record<string, unknown>;
            processing: {
                css: Record<string, unknown>;
                html: Record<string, unknown>;
                images: Record<string, unknown>;
                js: Record<string, unknown>;
            };
            publish: string;
            publishOrigin: string;
            services: Record<string, unknown>;
        };
        dev?: undefined | {
            command?: string | undefined;
            functions?: string | undefined;
            functionsPort?: number | undefined;
            https?: {
                certFile: string;
                keyFile: string;
            } | undefined;
            processing: {
                html?: {
                    injections?: {
                        /**
                         * The location at which the `html` will be injected.
                         * Defaults to `before_closing_head_tag` which will inject the HTML before the </head> tag.
                         */
                        location?: 'before_closing_head_tag' | 'before_closing_body_tag';
                        /**
                         * The injected HTML code.
                         */
                        html: string;
                    }[];
                };
            };
        };
        edge_functions?: EdgeFunctionDeclaration[];
        functions?: NetlifyConfig['functions'];
        functionsDirectory?: undefined | string;
        headers: MinimalHeader[];
        images: {
            remote_images: string[];
        };
        plugins?: Plugin[];
        redirects: undefined | NetlifyConfig['redirects'];
    };
    configPath?: undefined | string;
    context: string;
    headersPath?: unknown;
    logs?: unknown;
    redirectsPath?: unknown;
    token?: unknown;
}
export interface DefaultConfig {
    build: {
        command?: string | undefined;
        commandOrigin?: 'default' | undefined;
        publish?: string | undefined;
        publishOrigin?: 'default' | undefined;
    };
    plugins?: {
        package: unknown;
        origin: 'default';
    }[];
}
export type RunBuildOptions = Omit<NonNullable<Parameters<typeof build>[0]>, 'cachedConfig'> & {
    cachedConfig: CachedConfig;
    defaultConfig: DefaultConfig | Record<never, never>;
    edgeFunctionsBootstrapURL: string;
};
interface HandlerResult {
    newEnvChanges?: Record<string, string>;
    configMutations?: Record<string, string>;
    status?: string;
}
export type PatchedHandlerType<T extends (opts: any) => void | Promise<void>> = (opts: Parameters<T>[0]) => HandlerResult | Promise<HandlerResult>;
export declare const getRunBuildOptions: ({ cachedConfig, currentDir, defaultConfig, deployHandler, options: { context, cwd, debug, dry, json, offline, silent }, packagePath, token, }: {
    cachedConfig: CachedConfig;
    currentDir: string;
    defaultConfig?: undefined | DefaultConfig;
    deployHandler?: PatchedHandlerType<OnPostBuild>;
    options: OptionValues;
    packagePath?: string;
    token?: null | string;
}) => Promise<RunBuildOptions>;
export declare const runBuild: (options: RunBuildOptions) => Promise<{
    exitCode: number;
    newConfig: any;
    configMutations: any;
}>;
export {};
//# sourceMappingURL=build.d.ts.map