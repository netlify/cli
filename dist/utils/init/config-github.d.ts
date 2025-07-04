import type { GlobalConfigStore } from '../types.js';
import type { BaseCommand } from '../../commands/index.js';
/**
 * Get a valid GitHub token
 */
export declare const getGitHubToken: ({ globalConfig }: {
    globalConfig: GlobalConfigStore;
}) => Promise<string>;
export declare const configGithub: ({ command, repoName, repoOwner, siteId, }: {
    command: BaseCommand;
    repoName: string;
    repoOwner: string;
    siteId: string;
}) => Promise<void>;
//# sourceMappingURL=config-github.d.ts.map