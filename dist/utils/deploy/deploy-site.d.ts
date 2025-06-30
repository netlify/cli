import BaseCommand from '../../commands/base-command.js';
import { type $TSFixMe } from '../../commands/types.js';
import type { DeployEvent } from './status-cb.js';
export type { DeployEvent };
export declare const deploySite: (command: BaseCommand, api: $TSFixMe, siteId: any, dir: any, { assetType, branch, concurrentHash, concurrentUpload, config, deployId, deployTimeout, draft, filter, fnDir, functionsConfig, hashAlgorithm, manifestPath, maxRetry, siteRoot, skipFunctionsCache, statusCb, syncFileLimit, tmpDir, workingDir, }: {
    concurrentHash?: number;
    concurrentUpload?: number;
    deployTimeout?: number;
    draft?: boolean;
    maxRetry?: number;
    statusCb?: (status: DeployEvent) => void;
    syncFileLimit?: number;
    tmpDir?: string;
    fnDir?: string[];
    workingDir: string;
}) => Promise<{
    deployId: any;
    deploy: any;
    uploadList: any[];
}>;
//# sourceMappingURL=deploy-site.d.ts.map