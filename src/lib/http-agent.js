// @ts-check
const { readFile } = require('fs').promises

const { HttpsProxyAgent } = require('https-proxy-agent')
const waitPort = require('wait-port')

const { NETLIFYDEVERR, NETLIFYDEVWARN, exit, log } = require('../utils')

// https://github.com/TooTallNate/node-https-proxy-agent/issues/89
class HttpsProxyAgentWithCA extends HttpsProxyAgent {
  constructor(opts) {
    super(opts)
    this.ca = opts.ca
  }

  callback(req, opts) {
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

const tryGetAgent = async ({ certificateFile, httpProxy }) => {
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

  let open
  try {
    open = await waitPort({
      port: Number.parseInt(proxyUrl.port) || (scheme === 'http' ? DEFAULT_HTTP_PORT : DEFAULT_HTTPS_PORT),
      host: proxyUrl.hostname,
      timeout: AGENT_PORT_TIMEOUT,
      output: 'silent',
    })
  } catch (error) {
    // unknown error
    return { error: `${httpProxy} is not available.`, message: error.message }
  }

  if (!open) {
    // timeout error
    return { error: `Could not connect to '${httpProxy}'` }
  }

  let response = {}

  let certificate
  if (certificateFile) {
    try {
      certificate = await readFile(certificateFile)
    } catch (error) {
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
  response = { ...response, agent }
  return response
}

const getAgent = async ({ certificateFile, httpProxy }) => {
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

module.exports = { getAgent, tryGetAgent }
