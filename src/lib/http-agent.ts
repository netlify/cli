import type { Buffer } from 'buffer'
import { readFile } from 'fs/promises'
import type { ClientRequest } from 'http'

import { HttpsProxyAgent } from 'https-proxy-agent'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

type ConnectOptions = Parameters<HttpsProxyAgent<string>['connect']>[1]

interface HttpsProxyAgentWithCAOptions {
  port: string
  host: string
  hostname: string
  protocol: string
  ca: Buffer | undefined
}

// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
// Maybe replace with https://github.com/delvedor/hpagent
class HttpsProxyAgentWithCA extends HttpsProxyAgent<string> {
  declare ca: Buffer | undefined

  constructor(opts: HttpsProxyAgentWithCAOptions) {
    // @ts-expect-error FIXME(https-proxy-agent): written against the v2 API; v8 expects a proxy URL, not an options object
    super(opts)
    this.ca = opts.ca
  }

  callback(req: ClientRequest, opts: ConnectOptions) {
    // @ts-expect-error FIXME(https-proxy-agent): `callback()` is the v2 API; agent-base v7 never calls it, so `ca` is ignored
    return super.callback(req, {
      ...opts,
      ...(this.ca && { ca: this.ca }),
    })
  }
}

const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443
// 50 seconds
const AGENT_PORT_TIMEOUT = 50_000

type TryGetAgentResult =
  | { agent?: undefined; error?: string; warning?: string; message?: string }
  | { agent: HttpsProxyAgentWithCA; error?: undefined; warning?: string; message?: string }

export const tryGetAgent = async ({
  certificateFile,
  httpProxy,
}: {
  httpProxy?: string | undefined
  certificateFile?: string | undefined
}): Promise<TryGetAgentResult> => {
  if (!httpProxy) {
    return {}
  }

  let proxyUrl
  try {
    proxyUrl = new URL(httpProxy)
  } catch {
    return { error: `${httpProxy} is not a valid URL` }
  }

  const scheme = proxyUrl.protocol.slice(0, -1)
  if (!['http', 'https'].includes(scheme)) {
    return { error: `${httpProxy} must have a scheme of http or https` }
  }

  let port
  try {
    port = await waitPort(
      Number.parseInt(proxyUrl.port) || (scheme === 'http' ? DEFAULT_HTTP_PORT : DEFAULT_HTTPS_PORT),
      proxyUrl.hostname,
      AGENT_PORT_TIMEOUT,
    )
  } catch (error) {
    // unknown error
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    return { error: `${httpProxy} is not available.`, message: error.message }
  }

  if (!port.open) {
    // timeout error
    return { error: `Could not connect to '${httpProxy}'` }
  }

  let response: { warning?: string; message?: string } = {}

  let certificate: Buffer | undefined
  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      response = { warning: `Could not read certificate file '${certificateFile}'.`, message: error.message }
    }
  }

  const opts: HttpsProxyAgentWithCAOptions = {
    port: proxyUrl.port,
    host: proxyUrl.host,
    hostname: proxyUrl.hostname,
    protocol: proxyUrl.protocol,
    ca: certificate,
  }

  const agent = new HttpsProxyAgentWithCA(opts)
  return { ...response, agent }
}

export const getAgent = async ({
  certificateFile,
  httpProxy,
}: {
  httpProxy?: string | undefined
  certificateFile?: string | undefined
}) => {
  const { agent, error, message, warning } = await tryGetAgent({ httpProxy, certificateFile })
  if (error) {
    log(NETLIFYDEVERR, error, message || '')
    exit(1)
  }
  if (warning) {
    log(NETLIFYDEVWARN, warning, message || '')
  }
  return agent
}
