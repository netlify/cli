const headers = {
  ForwardedHost: 'x-forwarded-host',
  ForwardedProtocol: 'x-forwarded-proto',
  Functions: 'x-deno-functions',
  Geo: 'x-nf-geo',
  Passthrough: 'x-deno-pass',
  RequestID: 'X-NF-Request-ID',
  IP: 'x-nf-client-connection-ip',
  Site: 'X-NF-Site-Info',
  DebugLogging: 'x-nf-debug-logging',
}

export default headers
