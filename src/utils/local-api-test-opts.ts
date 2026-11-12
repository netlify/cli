const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export const getLocalApiTestOpts = ({
  host,
  scheme,
}: {
  host?: string
  scheme?: string
}): { host: string; scheme?: string } | undefined => {
  if (host === undefined) {
    return undefined
  }

  try {
    const { hostname } = new URL(`http://${host}`)
    return LOOPBACK_HOSTNAMES.has(hostname) ? { host, scheme } : undefined
  } catch {
    return undefined
  }
}
