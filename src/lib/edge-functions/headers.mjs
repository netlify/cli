const headers = {
  ForwardedHost: 'x-forwarded-host',
  Functions: 'x-nf-edge-functions',
  Geo: 'x-nf-geo',
  Passthrough: 'x-nf-passthrough',
  RequestID: 'X-NF-Request-ID',
  IP: 'x-nf-client-connection-ip',
  Site: 'X-NF-Site-Info',
  DebugLogging: 'x-nf-debug-logging',
}

export default headers
