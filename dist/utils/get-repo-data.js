import { dirname } from 'path';
import util from 'util';
import { findUp } from 'find-up';
import gitRepoInfo from 'git-repo-info';
import gitconfiglocal from 'gitconfiglocal';
import parseGithubUrl from 'parse-github-url';
import { log } from './command-helpers.js';
const getRepoData = async ({ remoteName, workingDir, }) => {
    try {
        const [gitConfig, gitDirectory] = await Promise.all([
            util.promisify(gitconfiglocal)(workingDir),
            findUp('.git', { cwd: workingDir, type: 'directory' }),
        ]);
        if (!gitDirectory || !gitConfig || !gitConfig.remote || Object.keys(gitConfig.remote).length === 0) {
            throw new Error('No Git remote found');
        }
        const baseGitPath = dirname(gitDirectory);
        if (workingDir !== baseGitPath) {
            log(`Git directory located in ${baseGitPath}`);
        }
        if (!remoteName) {
            const remotes = Object.keys(gitConfig.remote);
            remoteName = remotes.find((remote) => remote === 'origin') || remotes[0];
        }
        if (!Object.prototype.hasOwnProperty.call(gitConfig.remote, remoteName) ||
            !gitConfig.remote[remoteName] ||
            Object.keys(gitConfig.remote[remoteName]).length === 0) {
            throw new Error(`The specified remote "${remoteName}" is not defined in Git repo. Please use --git-remote-name flag to specify a remote.`);
        }
        const { url } = gitConfig.remote[remoteName];
        const parsedUrl = parseGithubUrl(url);
        // TODO(serhalp): Validate more aggressively? We should probably require `owner`, `repo`, `host`?
        if (parsedUrl == null) {
            throw new Error(`The specified Git remote ${remoteName} is not a valid URL: ${url}`);
        }
        const { host, name, owner, repo } = parsedUrl;
        const { branch } = gitRepoInfo();
        return {
            name,
            owner,
            repo,
            url,
            branch,
            provider: host != null ? PROVIDERS[host] ?? host : host,
            httpsUrl: `https://${host}/${repo}`,
        };
    }
    catch (error) {
        return {
            error: error instanceof Error ? error.message : error?.toString() ?? 'Failed to get repo data',
        };
    }
};
const PROVIDERS = {
    'github.com': 'github',
    'gitlab.com': 'gitlab',
};
export default getRepoData;
//# sourceMappingURL=get-repo-data.js.map