import { OptionValues } from 'commander';
import type BaseCommand from '../base-command.js';
import type { SiteInfo } from '../../utils/types.js';
import { type InitExitCode } from './constants.js';
type InitExitMessageCustomizer = (code: InitExitCode, defaultMessage: string) => string | undefined;
type InitExtraOptions = {
    customizeExitMessage?: InitExitMessageCustomizer | undefined;
    exitAfterConfiguringRepo?: boolean | undefined;
};
export declare const init: (options: OptionValues, command: BaseCommand, { customizeExitMessage, exitAfterConfiguringRepo }?: InitExtraOptions) => Promise<SiteInfo>;
export {};
//# sourceMappingURL=init.d.ts.map