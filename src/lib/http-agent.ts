import type { Buffer } from 'buffer'
import { readFile } from 'fs/promises'
import type { ClientRequest } from 'http'

import { HttpsProxyAgent } from 'https-proxy-agent'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

type ConnectOptions = Parameters<HttpsProxyAgent<string>['connect']>[1]

class HttpsProxyAgentWithCA extends HttpsProxyAgent<string> {
  readonly #ca: Buffer | undefined

  constructor(proxy: URL, ca: Buffer | undefined) {
    super(proxy, { ca })
    this.#ca = ca
  }

  // The constructor's `ca` only covers the connection to the proxy; the TLS upgrade to the target needs it too
  override connect(req: ClientRequest, opts: ConnectOptions) {
    return super.connect(req, opts.secureEndpoint && this.#ca ? { ...opts, ca: this.#ca } : opts)
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

  let certificate: Buffer | undefined
  let certificateWarning: { warning: string; message: string } | undefined
  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
      certificateWarning = {
        warning: `Could not read certificate file '${certificateFile}'.`,
        // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
        message: error.message,
      }
    }
  }

  return { ...certificateWarning, agent: new HttpsProxyAgentWithCA(proxyUrl, certificate) }
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
