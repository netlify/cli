/**
 * Normalize a user-provided repository specifier into a git URL and an HTTPS URL.
 *
 * @param repo Either a GitHub URL or a string in the format `owner/repo` (assumed to be GitHub)
 */
export declare const normalizeRepoUrl: (repo: string) => {
    repoUrl: string;
    httpsUrl: string;
    repoName: string;
};
//# sourceMappingURL=normalize-repo-url.d.ts.map