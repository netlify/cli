import type { NetlifyAPI } from '@netlify/api';
import type { SiteInfo } from '../utils/types.js';
export declare const cancelDeploy: ({ api, deployId }: {
    api: NetlifyAPI;
    deployId: string;
}) => Promise<void>;
export declare const listSites: ({ api, options, }: {
    api: NetlifyAPI;
    options: Parameters<typeof api.listSites>[0] & {
        page?: number;
        maxPages?: number;
    };
}) => Promise<SiteInfo[]>;
//# sourceMappingURL=api.d.ts.map