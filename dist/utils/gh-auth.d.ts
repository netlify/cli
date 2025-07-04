export interface Token {
    user: string;
    token: string;
    provider: string;
}
/**
 * Authenticate with the netlify app
 */
export declare const authWithNetlify: () => Promise<Token>;
/**
 * Get a GitHub token
 */
export declare const getGitHubToken: () => Promise<Token>;
//# sourceMappingURL=gh-auth.d.ts.map