/**
 *
 * @param {object} config
 * @param {string} [config.remoteName]
 * @param {string} config.workingDir
 * @returns
 */
declare const getRepoData: ({ remoteName, workingDir }: {
    remoteName: any;
    workingDir: any;
}) => Promise<{
    name: any;
    owner: any;
    repo: any;
    url: any;
    branch: string;
    provider: any;
    httpsUrl: string;
    error?: undefined;
} | {
    error: any;
    name?: undefined;
    owner?: undefined;
    repo?: undefined;
    url?: undefined;
    branch?: undefined;
    provider?: undefined;
    httpsUrl?: undefined;
}>;
export default getRepoData;
//# sourceMappingURL=get-repo-data.d.ts.map