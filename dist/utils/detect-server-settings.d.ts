import type { OptionValues } from 'commander';
import BaseCommand from '../commands/base-command.js';
import { type DevConfig } from '../commands/dev/types.js';
import { ServerSettings } from './types.js';
import { CachedConfig } from '../lib/build.js';
/**
 * Get the server settings based on the flags and the devConfig
 */
declare const detectServerSettings: (devConfig: DevConfig, flags: OptionValues, command: BaseCommand) => Promise<ServerSettings>;
/**
 * Returns a copy of the provided config with any plugins provided by the
 * server settings
 */
export declare const getConfigWithPlugins: (config: CachedConfig["config"], settings: ServerSettings) => {
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
                    location?: "before_closing_head_tag" | "before_closing_body_tag";
                    html: string;
                }[];
            };
        };
    };
    edge_functions?: import("../lib/edge-functions/proxy.js").EdgeFunctionDeclaration[];
    functions?: import("@netlify/build").NetlifyConfig["functions"];
    functionsDirectory?: undefined | string;
    headers: import("@netlify/headers-parser").MinimalHeader[];
    images: {
        remote_images: string[];
    };
    plugins?: import("./types.js").Plugin[];
    redirects: undefined | import("@netlify/build").NetlifyConfig["redirects"];
} | {
    plugins: (import("./types.js").Plugin | {
        package: string;
        origin: "config";
        inputs: Record<never, never>;
    })[];
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
                    location?: "before_closing_head_tag" | "before_closing_body_tag";
                    html: string;
                }[];
            };
        };
    };
    edge_functions?: import("../lib/edge-functions/proxy.js").EdgeFunctionDeclaration[];
    functions?: import("@netlify/build").NetlifyConfig["functions"];
    functionsDirectory?: undefined | string;
    headers: import("@netlify/headers-parser").MinimalHeader[];
    images: {
        remote_images: string[];
    };
    redirects: undefined | import("@netlify/build").NetlifyConfig["redirects"];
};
export default detectServerSettings;
//# sourceMappingURL=detect-server-settings.d.ts.map