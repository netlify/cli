import type { OptionValues } from 'commander';
import { type RunBuildOptions } from '../../lib/build.js';
import type BaseCommand from '../base-command.js';
export declare const checkOptions: ({ cachedConfig: { siteInfo }, token }: RunBuildOptions) => undefined;
export declare const build: (options: OptionValues, command: BaseCommand) => Promise<void>;
//# sourceMappingURL=build.d.ts.map