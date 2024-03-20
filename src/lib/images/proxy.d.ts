/// <reference types="node" resolution-mode="require"/>
import { NetlifyConfig } from '@netlify/build';
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
export declare const parseAllDomains: (config: any) => {
    errors: ErrorObject[];
    remoteDomains: string[];
};
interface ErrorObject {
    message: string;
}
export declare const handleImageDomainsErrors: (errors: ErrorObject[]) => Promise<void>;
export declare const parseRemoteImageDomains: ({ config }: {
    config: any;
}) => Promise<string[]>;
export declare const isImageRequest: (req: Request) => boolean;
export declare const transformImageParams: (query: QueryParams) => string;
export declare const initializeProxy: ({ config, settings, }: {
    config: NetlifyConfig;
    settings: ServerSettings;
}) => Promise<import("express-serve-static-core").Express>;
export {};
//# sourceMappingURL=proxy.d.ts.map