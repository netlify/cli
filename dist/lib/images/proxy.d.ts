import type { IncomingMessage } from 'http';
import { type NormalizedCachedConfigConfig } from '../../utils/command-helpers.js';
import type { ServerSettings } from '../../utils/types.d.ts';
export declare const IMAGE_URL_PATTERN = "/.netlify/images";
interface QueryParams {
    w?: string;
    width?: string;
    h?: string;
    height?: string;
    q?: string;
    quality?: string;
    fm?: string;
    fit?: string;
    position?: string;
}
export declare const parseAllRemoteImages: (config: Pick<NormalizedCachedConfigConfig, "images">) => {
    errors: ErrorObject[];
    remotePatterns: RegExp[];
};
interface ErrorObject {
    message: string;
}
export declare const isImageRequest: (req: IncomingMessage) => boolean;
export declare const transformImageParams: (query: QueryParams) => string;
export declare const initializeProxy: ({ config, settings, }: {
    config: NormalizedCachedConfigConfig;
    settings: ServerSettings;
}) => import("express-serve-static-core").Express;
export {};
//# sourceMappingURL=proxy.d.ts.map