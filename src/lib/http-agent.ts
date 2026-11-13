import { readFile } from 'fs/promises'
import type { ClientRequest } from 'http'
import https from 'https'
import net from 'net'
import tls from 'tls'

import { HttpsProxyAgent } from 'https-proxy-agent'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
// Maybe replace with https://github.com/delvedor/hpagent
// @ts-expect-error TS(2507) FIXME: Type 'typeof createHttpsProxyAgent' is not a const... Remove this comment to see the full error message
class HttpsProxyAgentWithCA extends HttpsProxyAgent {
  // @ts-expect-error TS(7006) FIXME: Parameter 'opts' implicitly has an 'any' type.
  constructor(opts) {
    super(opts)
    // @ts-expect-error TS(2339) FIXME: Property 'ca' does not exist on type 'HttpsProxyAg... Remove this comment to see the full error message
    this.ca = opts.ca
  }

  // @ts-expect-error TS(7006) FIXME: Parameter 'req' implicitly has an 'any' type.
  callback(req, opts) {
    return super.callback(req, {
      ...opts,
      // @ts-expect-error TS(2339) FIXME: Property 'ca' does not exist on type 'HttpsProxyAg... Remove this comment to see the full error message
      ...(this.ca && { ca: this.ca }),
    })
  }
}

const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443
// 50 seconds
const AGENT_PORT_TIMEOUT = 50_000

// Requests to the local machine (e.g. the framework dev server or the functions server in `netlify dev`)
// should never go through the proxy
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

const getNoProxy = (): string =>
  [process.env.NO_PROXY ?? process.env.no_proxy, ...LOOPBACK_HOSTS].filter(Boolean).join(',')

const normalizeHostname = (hostname: string): string => hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1')

/**
 * Whether a request to `hostname` should go through the proxy, using the same `NO_PROXY` rules as undici's
 * `EnvHttpProxyAgent`, so `fetch()` and `http`/`https` requests behave the same.
 */
const shouldProxy = (hostname: string, port: number, noProxy: string): boolean => {
  const host = normalizeHostname(hostname)

  return noProxy
    .split(/[,\s]/)
    .filter(Boolean)
    .every((entry) => {
      if (entry === '*') {
        return false
      }

      const parsed = /^(.+):(\d+)$/.exec(entry)
      const entryHost = normalizeHostname((parsed ? parsed[1] : entry).replace(/^\*?\./, ''))
      if (parsed && Number.parseInt(parsed[2], 10) !== port) {
        return true
      }

      return host !== entryHost && !host.endsWith(`.${entryHost}`)
    })
}

type ConnectOpts = Parameters<HttpsProxyAgent<string>['connect']>[1]

/**
 * Agent for `https` requests that don't set their own agent, e.g. the Netlify API client that
 * `@netlify/config` creates to retrieve the site info. Connects directly to hosts in `NO_PROXY`.
 */
class HttpsProxyAgentWithNoProxy extends HttpsProxyAgent<string> {
  constructor(
    proxy: string,
    private readonly noProxy: string,
    private readonly ca: Buffer | undefined,
  ) {
    super(proxy)
    // Used when connecting to an `https:` proxy
    if (ca) {
      this.connectOpts.ca = ca
    }
  }

  async connect(req: ClientRequest, opts: ConnectOpts): Promise<net.Socket> {
    if (!shouldProxy(opts.host ?? 'localhost', opts.port, this.noProxy)) {
      return opts.secureEndpoint
        ? tls.connect({ ...opts, servername: net.isIP(opts.host ?? '') ? undefined : opts.host })
        : net.connect(opts)
    }

    // Used for the TLS connection to the target host through the proxy
    return super.connect(req, opts.secureEndpoint && this.ca ? { ...opts, ca: this.ca } : opts)
  }
}

/**
 * Node.js's built-in `fetch()` ignores both `HTTP_PROXY` and the `agent` option, and so does any `http`/`https`
 * request that doesn't set an agent. The Netlify API client gets an agent, but other requests, e.g. by
 * `@netlify/config` or the CLI's own `fetch()` calls, need the proxy to be set globally.
 */
const getGlobalProxyAgents = (httpProxy: string, certificate: Buffer | undefined) => {
  const noProxy = getNoProxy()
  const tlsOptions = certificate ? { ca: certificate } : undefined

  return {
    dispatcher: new EnvHttpProxyAgent({
      httpProxy,
      httpsProxy: httpProxy,
      noProxy,
      requestTls: tlsOptions,
      proxyTls: tlsOptions,
    }),
    httpsGlobalAgent: new HttpsProxyAgentWithNoProxy(httpProxy, noProxy, certificate),
  }
}

export const tryGetAgent = async ({
  certificateFile,
  httpProxy,
}: {
  httpProxy?: string | undefined
  certificateFile?: string | undefined
}): Promise<
  | {
      error?: string | undefined
      warning?: string | undefined
      message?: string | undefined
    }
  | {
      agent: HttpsProxyAgentWithCA
      dispatcher: EnvHttpProxyAgent
      httpsGlobalAgent: https.Agent
      response: unknown
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
    // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
    return { error: `${httpProxy} is not available.`, message: error.message }
  }

  if (!port.open) {
    // timeout error
    return { error: `Could not connect to '${httpProxy}'` }
  }

  let response = {}

  let certificate
  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
      // @ts-expect-error TS(2571) FIXME: Object is of type 'unknown'.
      response = { warning: `Could not read certificate file '${certificateFile}'.`, message: error.message }
    }
  }

  const opts = {
    port: proxyUrl.port,
    host: proxyUrl.host,
    hostname: proxyUrl.hostname,
    protocol: proxyUrl.protocol,
    ca: certificate,
  }

  const agent = new HttpsProxyAgentWithCA(opts)
  response = { ...response, agent, ...getGlobalProxyAgents(httpProxy, certificate) }
  return response
}

// @ts-expect-error TS(7031) FIXME: Binding element 'certificateFile' implicitly has a... Remove this comment to see the full error message
export const getAgent = async ({ certificateFile, httpProxy }) => {
  const result = await tryGetAgent({ httpProxy, certificateFile })
  // @ts-expect-error TS(2339) FIXME: Property 'agent' does not exist on type '{ error?:... Remove this comment to see the full error message
  const { agent, error, message, warning } = result
  if (error) {
    log(NETLIFYDEVERR, error, message || '')
    exit(1)
  }
  if (warning) {
    log(NETLIFYDEVWARN, warning, message || '')
  }
  if ('dispatcher' in result) {
    setGlobalDispatcher(result.dispatcher)
    https.globalAgent = result.httpsGlobalAgent
  }
  return agent
}
