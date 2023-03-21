const headers = {
  FeatureFlags: 'x-nf-feature-flags',
  ForwardedHost: 'x-forwarded-host',
  Functions: 'x-nf-edge-functions',
  InvocationMetadata: 'x-nf-edge-functions-metadata',
  Geo: 'x-nf-geo',
  Passthrough: 'x-nf-passthrough',
  IP: 'x-nf-client-connection-ip',
  Site: 'X-NF-Site-Info',
  DebugLogging: 'x-nf-debug-logging',
}

export default headers
