import { readFile } from 'fs/promises'
import { ClientRequest, RequestOptions } from 'http'

import { HttpsProxyAgent, HttpsProxyAgentOptions } from 'https-proxy-agent'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
// Maybe replace with https://github.com/delvedor/hpagent
class HttpsProxyAgentWithCA extends HttpsProxyAgent {
  ca: Buffer | undefined

  constructor(opts: HttpsProxyAgentOptions) {
    super(opts)
    this.ca = opts.ca
  }

  callback(req: ClientRequest, opts: RequestOptions) {
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

const isError = (error: unknown): error is Error => error instanceof Error

export const tryGetAgent = async ({
  certificateFile,
  httpProxy,
}: {
  httpProxy?: string
  certificateFile?: string
}): Promise<
  | {
      error?: string
      warning?: string
      message?: string
      agent?: undefined
    }
  | {
      agent: HttpsProxyAgentWithCA
      response?: unknown
      error?: undefined
      warning?: string
      message?: string
    }
> => {
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
    return { error: `${httpProxy} is not available.`, message: isError(error) ? error.message : String(error) }
  }

  if (!port.open) {
    // timeout error
    return { error: `Could not connect to '${httpProxy}'` }
  }

  let response: { warning?: string; message?: string } = {}

  let certificate
  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
      response = {
        warning: `Could not read certificate file '${certificateFile}'.`,
        message: isError(error) ? error.message : String(error),
      }
    }
  }

  const opts: HttpsProxyAgentOptions = {
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
  httpProxy?: string
  certificateFile?: string
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
