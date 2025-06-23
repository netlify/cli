import BaseCommand from '../base-command.js';
export type Extension = {
    id: string;
    name: string;
    slug: string;
    hostSiteUrl: string;
    installedOnTeam: boolean;
};
export type SiteInfo = {
    id: string;
    name: string;
    account_id: string;
    admin_url: string;
    url: string;
    ssl_url: string;
};
export declare const createDatabaseCommand: (program: BaseCommand) => void;
//# sourceMappingURL=database.d.ts.map