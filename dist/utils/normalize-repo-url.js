import parseGitHubUrl from 'parse-github-url';
/**
 * Normalize a user-provided repository specifier into a git URL and an HTTPS URL.
 *
 * @param repo Either a GitHub URL or a string in the format `owner/repo` (assumed to be GitHub)
 */
export const normalizeRepoUrl = (repo) => {
    const parsedRepoUrl = parseGitHubUrl(repo);
    if (!parsedRepoUrl?.owner || !parsedRepoUrl.name) {
        throw new Error(`Invalid repository URL: ${repo}`);
    }
    const repoUrl = parsedRepoUrl.hostname
        ? parsedRepoUrl.href
        : `git@github.com:${parsedRepoUrl.owner}/${parsedRepoUrl.name}.git`;
    const httpsUrl = parsedRepoUrl.hostname
        ? `https://${parsedRepoUrl.hostname}/${parsedRepoUrl.owner}/${parsedRepoUrl.name}`
        : `https://github.com/${parsedRepoUrl.owner}/${parsedRepoUrl.name}`;
    return {
        repoUrl,
        httpsUrl,
        repoName: parsedRepoUrl.name,
    };
};
//# sourceMappingURL=normalize-repo-url.js.map