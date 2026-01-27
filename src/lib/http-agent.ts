import { readFile } from 'fs/promises'

import { HttpsProxyAgent } from 'https-proxy-agent'

import { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } from '../utils/command-helpers.js'
import { waitPort } from './wait-port.js'

const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443
// 50 seconds
const AGENT_PORT_TIMEOUT = 50_000

type Success = {
  agent: HttpsProxyAgent<string>
  warning?: { message: string; details?: string }
}

type Failure = {
  error: { message: string; details?: string }
}

export const tryGetAgent = async ({
  certificateFile,
  httpProxy,
}: {
  httpProxy?: string | undefined
  certificateFile?: string | undefined
}): Promise<Success | Failure | undefined> => {
  if (!httpProxy) {
    return
  }

  let proxyUrl: URL
  try {
    proxyUrl = new URL(httpProxy)
  } catch {
    return { error: { message: `${httpProxy} is not a valid URL` } }
  }

  const scheme = proxyUrl.protocol.slice(0, -1)
  if (!['http', 'https'].includes(scheme)) {
    return { error: { message: `${httpProxy} must have a scheme of http or https` } }
  }

  try {
    const port = await waitPort(
      Number.parseInt(proxyUrl.port) || (scheme === 'http' ? DEFAULT_HTTP_PORT : DEFAULT_HTTPS_PORT),
      proxyUrl.hostname,
      AGENT_PORT_TIMEOUT,
    )

    if (!port.open) {
      // timeout error
      return { error: { message: `Could not connect to '${httpProxy}'` } }
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error)

    return { error: { message: `${httpProxy} is not available.`, details } }
  }

  let certificate: Buffer | undefined
  let warning: { message: string; details?: string } | undefined

  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error)

      warning = { message: `Could not read certificate file '${certificateFile}'.`, details }
    }
  }

  const agent = new HttpsProxyAgent(httpProxy, { ca: certificate })

  return { agent, warning }
}

export const getAgent = async ({
  certificateFile,
  httpProxy,
}: {
  certificateFile?: string
  httpProxy?: string
}): Promise<HttpsProxyAgent<string> | undefined> => {
  const result = await tryGetAgent({ httpProxy, certificateFile })

  if (result && 'error' in result) {
    const {
      error: { details, message },
    } = result
    log(NETLIFYDEVERR, message, details || '')
    exit(1)
  }

  if (result && 'warning' in result && result.warning) {
    const {
      warning: { details, message },
    } = result
    log(NETLIFYDEVWARN, message, details || '')
  }

  return result && 'agent' in result ? result.agent : undefined
}
