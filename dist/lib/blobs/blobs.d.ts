interface BaseBlobsContext {
    deployID: string;
    siteID: string;
    primaryRegion?: string;
    token: string;
}
export interface BlobsContextWithAPIAccess extends BaseBlobsContext {
    apiURL: string;
}
export interface BlobsContextWithEdgeAccess extends BaseBlobsContext {
    edgeURL: string;
    uncachedEdgeURL: string;
}
export type BlobsContext = BlobsContextWithAPIAccess | BlobsContextWithEdgeAccess;
export declare const BLOBS_CONTEXT_VARIABLE = "NETLIFY_BLOBS_CONTEXT";
interface GetBlobsContextOptions {
    debug: boolean;
    projectRoot: string;
    siteID: string;
}
/**
 * Starts a local Blobs server and returns a context object that lets build
 * plugins connect to it.
 */
export declare const getBlobsContextWithAPIAccess: ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => Promise<BlobsContextWithAPIAccess>;
/**
 * Starts a local Blobs server and returns a context object that lets functions
 * and edge functions connect to it.
 */
export declare const getBlobsContextWithEdgeAccess: ({ debug, projectRoot, siteID }: GetBlobsContextOptions) => Promise<BlobsContextWithEdgeAccess>;
/**
 * Returns the Blobs metadata that should be added to the Lambda event when
 * invoking a serverless function.
 */
export declare const getBlobsEventProperty: (context: BlobsContextWithEdgeAccess) => {
    primary_region: string | undefined;
    url: string;
    url_uncached: string;
    token: string;
};
/**
 * Returns a Base-64, JSON-encoded representation of the Blobs context. This is
 * the format that the `@netlify/blobs` package expects to find the context in.
 */
export declare const encodeBlobsContext: (context: BlobsContext) => string;
export {};
//# sourceMappingURL=blobs.d.ts.map