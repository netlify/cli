import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
/**
 * @param {import('../../lib/build.js').BuildConfig} options
 */
export declare const checkOptions: ({ cachedConfig: { siteInfo }, token }: {
    cachedConfig: {
        siteInfo?: {} | undefined;
    };
    token: any;
}) => void;
export declare const build: (options: OptionValues, command: BaseCommand) => Promise<void>;
//# sourceMappingURL=build.d.ts.map