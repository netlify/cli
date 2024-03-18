import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
interface Options extends OptionValues {
    input?: string;
}
export declare const blobsSet: (storeName: string, key: string, valueParts: string[], options: Options, command: BaseCommand) => Promise<void>;
export {};
//# sourceMappingURL=blobs-set.d.ts.map