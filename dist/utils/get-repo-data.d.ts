export interface RepoData {
    name: string | null;
    owner: string | null;
    repo: string | null;
    url: string;
    branch: string;
    provider: string | null;
    httpsUrl: string;
}
declare const getRepoData: ({ remoteName, workingDir, }: {
    remoteName?: string;
    workingDir: string;
}) => Promise<RepoData | {
    error: string;
}>;
export default getRepoData;
//# sourceMappingURL=get-repo-data.d.ts.map