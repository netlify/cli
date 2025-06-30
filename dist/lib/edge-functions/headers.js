import { Buffer } from 'buffer';
export const headers = {
    BlobsInfo: 'x-nf-blobs-info',
    DeployID: 'x-nf-deploy-id',
    DeployContext: 'x-nf-deploy-context',
    FeatureFlags: 'x-nf-feature-flags',
    ForwardedHost: 'x-forwarded-host',
    ForwardedProtocol: 'x-forwarded-proto',
    Functions: 'x-nf-edge-functions',
    InvocationMetadata: 'x-nf-edge-functions-metadata',
    Geo: 'x-nf-geo',
    Passthrough: 'x-nf-passthrough',
    PassthroughHost: 'x-nf-passthrough-host',
    PassthroughProtocol: 'x-nf-passthrough-proto',
    IP: 'x-nf-client-connection-ip',
    Site: 'X-NF-Site-Info',
    DebugLogging: 'x-nf-debug-logging',
    Account: 'x-nf-account-info',
};
/**
 * Takes an array of feature flags and produces a Base64-encoded JSON object
 * that the bootstrap layer can understand.
 *
 * @param {Array<string>} featureFlags
 * @returns {string}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'featureFlags' implicitly has an 'any' t... Remove this comment to see the full error message
export const getFeatureFlagsHeader = (featureFlags) => {
    // @ts-expect-error TS(7006) FIXME: Parameter 'acc' implicitly has an 'any' type.
    const featureFlagsObject = featureFlags.reduce((acc, flagName) => ({ ...acc, [flagName]: true }), {});
    return Buffer.from(JSON.stringify(featureFlagsObject)).toString('base64');
};
/**
 * Takes the invocation metadata object and produces a Base64-encoded JSON
 * object that the bootstrap layer can understand.
 *
 * @param {object} metadata
 * @returns {string}
 */
// @ts-expect-error TS(7006) FIXME: Parameter 'metadata' implicitly has an 'any' type.
export const getInvocationMetadataHeader = (metadata) => Buffer.from(JSON.stringify(metadata)).toString('base64');
//# sourceMappingURL=headers.js.map