declare const GITHUB = "GitHub";
/**
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
export declare const readRepoURL: (url: string) => Promise<unknown>;
export declare const validateRepoURL: (url: string) => typeof GITHUB | null;
export declare const parseRepoURL: (repoHost: string, url: {
    path: string | null;
}) => string[];
export {};
//# sourceMappingURL=read-repo-url.d.ts.map