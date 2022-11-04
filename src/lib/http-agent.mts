// @ts-check
import {readFile} from 'fs/promises'
import httpsProxyAgentPkg from 'https-proxy-agent'
import waitPort from 'wait-port'

import utils from '../utils/index.mjs'
const {HttpsProxyAgent} = httpsProxyAgentPkg
const { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } = utils

// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
class HttpsProxyAgentWithCA extends HttpsProxyAgent {
  ca: $TSFixMe;
  constructor(opts: $TSFixMe) {
    super(opts)
    this.ca = opts.ca
  }

  callback(req: $TSFixMe, opts: $TSFixMe) {
    return super.callback(req, {
      ...opts,
      ...(this.ca && { ca: this.ca }),
    })
  }
}

const DEFAULT_HTTP_PORT = 80
const DEFAULT_HTTPS_PORT = 443
// 50 seconds
const AGENT_PORT_TIMEOUT = 50

export const tryGetAgent = async ({
  certificateFile,
  httpProxy
}: $TSFixMe) => {
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
    port = await waitPort({
      port: Number.parseInt(proxyUrl.port) || (scheme === 'http' ? DEFAULT_HTTP_PORT : DEFAULT_HTTPS_PORT),
      host: proxyUrl.hostname,
      timeout: AGENT_PORT_TIMEOUT,
      output: 'silent',
    })
  } catch (error) {
    // unknown error
return { error: `${httpProxy} is not available.`, message: (error as $TSFixMe).message };
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
      response = { warning: `Could not read certificate file '${certificateFile}'.`, message: (error as $TSFixMe).message };
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
  response = { ...response, agent }
  return response
}

export const getAgent = async ({
  certificateFile,
  httpProxy
}: $TSFixMe) => {
  // @ts-expect-error TS(2339) FIXME: Property 'agent' does not exist on type '{ error?:... Remove this comment to see the full error message
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
