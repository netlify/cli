/**
 * @param {string} _url
 * Takes a url like https://github.com/netlify-labs/all-the-functions/tree/master/functions/9-using-middleware
 * and returns https://api.github.com/repos/netlify-labs/all-the-functions/contents/functions/9-using-middleware
 */
export declare const readRepoURL: (_url: any) => Promise<any>;
/**
 * @param {string} _url
 */
export declare const validateRepoURL: (_url: any) => "GitHub" | null;
export declare const parseRepoURL: (repoHost: any, URL: any) => any[];
//# sourceMappingURL=read-repo-url.d.ts.map