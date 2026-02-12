import { readFile } from 'fs/promises'
import http from 'http'

import { HttpsProxyAgent, type HttpsProxyAgentOptions } from 'https-proxy-agent'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443
// 50 seconds
const AGENT_PORT_TIMEOUT = 50_000

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
      agent: HttpsProxyAgent<string>
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

  const agent = new HttpsProxyAgent(httpProxy, { ca: certificate })
  response = { ...response, agent }
  return response
}

export const getAgent = async ({
  certificateFile,
  httpProxy,
}: {
  certificateFile?: string
  httpProxy?: string
}): Promise<HttpsProxyAgent<string> | undefined> => {
  const result = await tryGetAgent({ httpProxy, certificateFile })

  if ('error' in result && result.error) {
    log(NETLIFYDEVERR, result.error, result.message || '')
    exit(1)
  }

  if ('warning' in result && result.warning) {
    log(NETLIFYDEVWARN, result.warning, result.message || '')
  }

  if ('agent' in result) {
    return result.agent
  }
}
