import type { Project } from '@netlify/build-info';
import type { NetlifySite } from '../commands/types.js';
import type { SiteInfo } from '../utils/types.js';
export declare const packagesThatNeedSites: Set<string>;
export type DoesProjectRequireLinkedSiteParams = {
    project: Project;
    site: NetlifySite;
    siteInfo: SiteInfo;
    options: Record<string, unknown>;
};
export declare const doesProjectRequireLinkedSite: ({ options, project, site, siteInfo, }: DoesProjectRequireLinkedSiteParams) => Promise<[boolean, string[]]>;
//# sourceMappingURL=extensions.d.ts.map