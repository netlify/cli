const { URL } = require('url')
const { NETLIFYDEVERR, NETLIFYDEVWARN } = require('../utils/logo')
const waitPort = require('wait-port')
const { HttpsProxyAgent } = require('https-proxy-agent')
const fs = require('fs-extra')

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

const getAgent = async ({ httpProxy, certificateFile, log, exit }) => {
  if (!httpProxy) {
    return undefined
  }

  let proxyUrl
  try {
    proxyUrl = new URL(httpProxy)
  } catch (e) {
    log(NETLIFYDEVERR, `${httpProxy} is not a valid URL`)
    exit(1)
  }

  const scheme = proxyUrl.protocol.substr(0, proxyUrl.protocol.length - 1)
  if (!['http', 'https'].includes(scheme)) {
    log(NETLIFYDEVERR, `${httpProxy} must have a scheme of http or https`)
    exit(1)
  }

  let open
  try {
    open = await waitPort({
      port: parseInt(proxyUrl.port) || (scheme === 'http' ? 80 : 443),
      host: proxyUrl.hostname,
      timeout: 50,
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
      certificate = await fs.readFile(certificateFile)
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
