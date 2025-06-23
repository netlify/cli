import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
interface Options extends OptionValues {
    output?: string;
}
export declare const blobsGet: (storeName: string, key: string, options: Options, command: BaseCommand) => Promise<undefined>;
export {};
//# sourceMappingURL=blobs-get.d.ts.map