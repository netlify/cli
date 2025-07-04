import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
interface Options extends OptionValues {
    directories?: boolean;
    json?: boolean;
    prefix?: string;
}
export declare const blobsList: (storeName: string, options: Options, command: BaseCommand) => Promise<undefined>;
export {};
//# sourceMappingURL=blobs-list.d.ts.map