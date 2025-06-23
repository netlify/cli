import type { OptionValues } from 'commander';
import type BaseCommand from '../base-command.js';
interface AIStartOptions extends OptionValues {
    debug?: boolean;
}
export declare const aiStartCommand: (options: AIStartOptions, command: BaseCommand) => Promise<void>;
export {};
//# sourceMappingURL=ai-start.d.ts.map