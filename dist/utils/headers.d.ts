import { type Header } from '@netlify/headers-parser';
import { type NormalizedCachedConfigConfig } from './command-helpers.js';
/**
 * Get the matching headers for `path` given a set of `rules`.
 */
export declare const headersForPath: (headers: Header[], path: string) => any;
export declare const parseHeaders: ({ config, configPath, headersFiles, }: {
    config: NormalizedCachedConfigConfig;
    configPath?: string | undefined;
    headersFiles?: string[] | undefined;
}) => Promise<Header[]>;
export declare const NFFunctionName = "x-nf-function-name";
export declare const NFFunctionRoute = "x-nf-function-route";
export declare const NFRequestID = "x-nf-request-id";
//# sourceMappingURL=headers.d.ts.map