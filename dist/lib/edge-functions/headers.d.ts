export declare const headers: {
    BlobsInfo: string;
    DeployID: string;
    DeployContext: string;
    FeatureFlags: string;
    ForwardedHost: string;
    ForwardedProtocol: string;
    Functions: string;
    InvocationMetadata: string;
    Geo: string;
    Passthrough: string;
    PassthroughHost: string;
    PassthroughProtocol: string;
    IP: string;
    Site: string;
    DebugLogging: string;
    Account: string;
};
/**
 * Takes an array of feature flags and produces a Base64-encoded JSON object
 * that the bootstrap layer can understand.
 *
 * @param {Array<string>} featureFlags
 * @returns {string}
 */
export declare const getFeatureFlagsHeader: (featureFlags: any) => string;
/**
 * Takes the invocation metadata object and produces a Base64-encoded JSON
 * object that the bootstrap layer can understand.
 *
 * @param {object} metadata
 * @returns {string}
 */
export declare const getInvocationMetadataHeader: (metadata: any) => string;
//# sourceMappingURL=headers.d.ts.map