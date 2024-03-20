import { OptionValues } from 'commander';
import BaseCommand from '../base-command.js';
export declare function areScopesEqual(localScopes: any, remoteScopes: any): any;
export declare function registerIntegration(workingDir: any, siteId: any, accountId: any, localIntegrationConfig: any, token: any): Promise<void>;
export declare function updateIntegration(workingDir: any, options: any, siteId: any, accountId: any, localIntegrationConfig: any, token: any, registeredIntegration: any): Promise<void>;
export declare const getConfiguration: (workingDir: any) => any;
export declare const deploy: (options: OptionValues, command: BaseCommand) => Promise<void>;
//# sourceMappingURL=deploy.d.ts.map