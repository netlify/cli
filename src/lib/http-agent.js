const { URL } = require('url')

const { HttpsProxyAgent } = require('https-proxy-agent')
const waitPort = require('wait-port')

const { NETLIFYDEVERR, NETLIFYDEVWARN } = require('../utils/logo')

const fs = require('./fs')

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

const getAgent = async ({ httpProxy, certificateFile, log, exit }) => {
  if (!httpProxy) {
    return
  }

  let proxyUrl
  try {
    proxyUrl = new URL(httpProxy)
  } catch (error) {
    log(NETLIFYDEVERR, `${httpProxy} is not a valid URL`)
    exit(1)
  }

  const scheme = proxyUrl.protocol.slice(0, -1)
  if (!['http', 'https'].includes(scheme)) {
    log(NETLIFYDEVERR, `${httpProxy} must have a scheme of http or https`)
    exit(1)
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
    log(NETLIFYDEVERR, `${httpProxy} is not available.`, error.message)
    exit(1)
  }

  if (!open) {
    // timeout error
    log(NETLIFYDEVERR, `Could not connect to '${httpProxy}'`)
    exit(1)
  }

  let certificate
  if (certificateFile) {
    try {
      certificate = await fs.readFileAsync(certificateFile)
    } catch (error) {
      log(NETLIFYDEVWARN, `Could not read certificate file '${certificateFile}'.`, error.message)
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
  return agent
}

module.exports = { getAgent }
