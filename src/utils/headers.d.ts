/**
 * Get the matching headers for `path` given a set of `rules`.
 *
 * @param {Object<string,Object<string,string[]>>!} headers
 * The rules to use for matching.
 *
 * @param {string!} path
 * The path to match against.
 *
 * @returns {Object<string,string[]>}
 */
export declare const headersForPath: (headers: any, path: any) => any;
export declare const parseHeaders: ({ configPath, headersFiles }: {
    configPath: any;
    headersFiles: any;
}) => Promise<Header[]>;
export declare const NFFunctionName = "x-nf-function-name";
export declare const NFFunctionRoute = "x-nf-function-route";
export declare const NFRequestID = "x-nf-request-id";
//# sourceMappingURL=headers.d.ts.map