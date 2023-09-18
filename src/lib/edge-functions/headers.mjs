// @ts-check
import { Buffer } from 'buffer'

export const headers = {
  DeployID: 'x-nf-deploy-id',
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
}

/**
 * Takes an array of feature flags and produces a Base64-encoded JSON object
 * that the bootstrap layer can understand.
 *
 * @param {Array<string>} featureFlags
 * @returns {string}
 */
export const getFeatureFlagsHeader = (featureFlags) => {
  const featureFlagsObject = featureFlags.reduce((acc, flagName) => ({ ...acc, [flagName]: true }), {})

  return Buffer.from(JSON.stringify(featureFlagsObject)).toString('base64')
}

/**
 * Takes the invocation metadata object and produces a Base64-encoded JSON
 * object that the bootstrap layer can understand.
 *
 * @param {object} metadata
 * @returns {string}
 */
export const getInvocationMetadataHeader = (metadata) => Buffer.from(JSON.stringify(metadata)).toString('base64')
