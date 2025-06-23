import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
interface Options extends OptionValues {
    input?: string;
    force?: string | boolean;
}
export declare const blobsSet: (storeName: string, key: string, valueParts: string[], options: Options, command: BaseCommand) => Promise<undefined>;
export {};
//# sourceMappingURL=blobs-set.d.ts.map