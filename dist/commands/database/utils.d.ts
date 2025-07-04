import BaseCommand from '../base-command.js';
import { Extension } from './database.js';
import { spawn } from 'child_process';
type PackageJSON = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
};
export declare function getPackageJSON(directory: string): PackageJSON;
export declare const spawnAsync: (command: string, args: string[], options: Parameters<typeof spawn>[2]) => Promise<number>;
export declare const getExtension: ({ accountId, netlifyToken, slug, }: {
    accountId: string;
    netlifyToken: string;
    slug: string;
}) => Promise<Extension | undefined>;
export declare const installExtension: ({ netlifyToken, accountId, slug, hostSiteUrl, }: {
    netlifyToken: string;
    accountId: string;
    slug: string;
    hostSiteUrl: string;
}) => Promise<boolean>;
export declare const getSiteConfiguration: ({ siteId, accountId, netlifyToken, slug, }: {
    siteId: string;
    accountId: string;
    netlifyToken: string;
    slug: string;
}) => Promise<unknown>;
export declare const carefullyWriteFile: (filePath: string, data: string, projectRoot: string) => Promise<void>;
export declare const getAccount: (command: BaseCommand, { accountId, }: {
    accountId: string;
}) => Promise<{
    id: string;
    name: string;
} & Omit<{
    id?: string;
    name?: string;
    slug?: string;
    type?: string;
    capabilities?: {
        sites?: import("@netlify/open-api").components["schemas"]["accountUsageCapability"];
        collaborators?: import("@netlify/open-api").components["schemas"]["accountUsageCapability"];
    };
    billing_name?: string;
    billing_email?: string;
    billing_details?: string;
    billing_period?: string;
    payment_method_id?: string;
    type_name?: string;
    type_id?: string;
    owner_ids?: string[];
    roles_allowed?: string[];
    created_at?: string;
    updated_at?: string;
}, "name" | "id">>;
type JigsawTokenResult = {
    data: string;
    error: null;
} | {
    data: null;
    error: {
        code: number;
        message: string;
    };
};
export declare const getJigsawToken: ({ netlifyToken, accountId, integrationSlug, isEnable, }: {
    netlifyToken: string;
    accountId: string;
    integrationSlug?: string;
    /**
     * isEnable will make a token that can install the extension
     */
    isEnable?: boolean;
}) => Promise<JigsawTokenResult>;
export {};
//# sourceMappingURL=utils.d.ts.map