import BaseCommand from '../../commands/base-command.js';
import { $TSFixMe } from '../../commands/types.js';
declare const hashFns: (command: BaseCommand, directories: string[], { concurrentHash, functionsConfig, hashAlgorithm, manifestPath, rootDir, skipFunctionsCache, statusCb, tmpDir, }: {
    concurrentHash?: number;
    functionsConfig?: $TSFixMe;
    hashAlgorithm?: string | undefined;
    manifestPath?: string | undefined;
    rootDir?: string | undefined;
    skipFunctionsCache?: boolean | undefined;
    statusCb: $TSFixMe;
    tmpDir: $TSFixMe;
}) => Promise<{
    functionSchedules?: {
        name: string;
        cron: string;
    }[] | undefined;
    functions: Record<string, string>;
    functionsWithNativeModules: $TSFixMe[];
    shaMap?: Record<string, $TSFixMe> | undefined;
    fnShaMap?: Record<string, $TSFixMe[]> | undefined;
    fnConfig?: Record<string, $TSFixMe> | undefined;
}>;
export default hashFns;
//# sourceMappingURL=hash-fns.d.ts.map