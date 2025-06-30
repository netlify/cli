import type { OptionValues } from 'commander';
import type { SiteInfo } from '../../utils/types.js';
import type BaseCommand from '../base-command.js';
export declare const getSiteNameInput: (name: string | undefined) => Promise<{
    name: string;
}>;
export declare const sitesCreate: (options: OptionValues, command: BaseCommand) => Promise<SiteInfo>;
//# sourceMappingURL=sites-create.d.ts.map