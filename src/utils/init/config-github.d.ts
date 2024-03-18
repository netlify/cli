/**
 * Get a valid GitHub token
 * @returns {Promise<string>}
 */
export declare const getGitHubToken: ({ globalConfig }: {
    globalConfig: any;
}) => Promise<any>;
/**
 * @param {object} config
 * @param {import('../../commands/base-command.js').default} config.command
 * @param {string} config.repoName
 * @param {string} config.repoOwner
 * @param {string} config.siteId
 */
export declare const configGithub: ({ command, repoName, repoOwner, siteId }: {
    command: any;
    repoName: any;
    repoOwner: any;
    siteId: any;
}) => Promise<void>;
//# sourceMappingURL=config-github.d.ts.map