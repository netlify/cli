export declare const BLOBS_CONTEXT_VARIABLE = "NETLIFY_BLOBS_CONTEXT";
export interface BlobsContext {
    deployID: string;
    edgeURL: string;
    siteID: string;
    token: string;
}
interface GetBlobsContextOptions {
    debug: boolean;
    projectRoot: string;
    siteID: string;
}
/**
 * Starts a local Blobs server and returns a context object that lets functions
 * connect to it.
 */
export declare const getBlobsContext: ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => Promise<BlobsContext>;
/**
 * Returns a Base-64, JSON-encoded representation of the Blobs context. This is
 * the format that the `@netlify/blobs` package expects to find the context in.
 */
export declare const encodeBlobsContext: (context: BlobsContext) => string;
export {};
//# sourceMappingURL=blobs.d.ts.map