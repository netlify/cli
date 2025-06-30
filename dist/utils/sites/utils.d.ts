import { GitHubRepoResponse } from '../command-helpers.js';
import { GitHubRepo } from '../types.js';
export declare const getTemplatesFromGitHub: (token: string) => Promise<GitHubRepo[]>;
export declare const validateTemplate: ({ ghToken, templateName }: {
    ghToken: string;
    templateName: string;
}) => Promise<{
    exists: boolean;
    isTemplate?: undefined;
} | {
    exists: boolean;
    isTemplate: boolean | undefined;
}>;
export declare const createRepo: (templateName: string, ghToken: string, siteName: string) => Promise<GitHubRepoResponse>;
export declare const callLinkSite: (cliPath: string, repoName: string, input: string) => Promise<string>;
//# sourceMappingURL=utils.d.ts.map