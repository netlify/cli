const url = require('url')
const { URLSearchParams } = require('url')
const path = require('path')
const fs = require('fs')
const { flags } = require('@oclif/command')
const child_process = require('child_process')
const http = require('http')
const httpProxy = require('http-proxy')
const waitPort = require('wait-port')
const getPort = require('get-port')
const chokidar = require('chokidar')
const proxyMiddleware = require('http-proxy-middleware')
const cookie = require('cookie')
const get = require('lodash.get')
const isEmpty = require('lodash.isempty')
const { serveFunctions } = require('../../utils/serve-functions')
const { serverSettings } = require('../../utils/detect-server')
const { detectFunctionsBuilder } = require('../../utils/detect-functions-builder')
const Command = require('../../utils/command')
const chalk = require('chalk')
const jwtDecode = require('jwt-decode')
const open = require('open')
const dotenv = require('dotenv')
const {
  NETLIFYDEV,
  NETLIFYDEVLOG,
  NETLIFYDEVWARN,
  NETLIFYDEVERR
} = require('../../utils/logo')
const boxen = require('boxen')
const { createTunnel, connectTunnel } = require('../../utils/live-tunnel')
const createRewriter = require('../../utils/rules-proxy')

function isFunction(functionsPort, req) {
  return functionsPort && req.url.match(/^\/.netlify\/functions\/.+/)
}

function addonUrl(addonUrls, req) {
  const m = req.url.match(/^\/.netlify\/([^\/]+)(\/.*)/) // eslint-disable-line no-useless-escape
  const addonUrl = m && addonUrls[m[1]]
  return addonUrl ? `${addonUrl}${m[2]}` : null
}

function notStatic(pathname, publicFolder) {
  return alternativePathsFor(pathname)
    .map(p => path.resolve(publicFolder, p))
    .every(p => !fs.existsSync(p))
}

function isExternal(match) {
  return match.to && match.to.match(/^https?:\/\//)
}

function isNetlifyDir(dir, projectDir) {
  return dir.startsWith(path.resolve(projectDir, '.netlify'))
}

function isRedirect(match) {
  return match.status && (match.status >= 300 && match.status <= 400)
}

function render404(publicFolder) {
  const maybe404Page = path.resolve(publicFolder, '404.html')
  if (fs.existsSync(maybe404Page)) return fs.readFileSync(maybe404Page)
  return 'Not Found'
}

// Used as an optimization to avoid dual lookups for missing assets
const assetExtensionRegExp = /\.(html?|png|jpg|js|css|svg|gif|ico|woff|woff2)$/

function alternativePathsFor(url) {
  const paths = []
  if (url[url.length - 1] === '/') {
    const end = url.length - 1
    if (url !== '/') {
      paths.push(url.slice(0, end) + '.html')
      paths.push(url.slice(0, end) + '.htm')
    }
    paths.push(url + 'index.html')
    paths.push(url + 'index.htm')
  } else if (!url.match(assetExtensionRegExp)) {
    paths.push(url + '.html')
    paths.push(url + '.htm')
    paths.push(url + '/index.html')
    paths.push(url + '/index.htm')
  }

  return paths
}

function initializeProxy(port) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host: 'localhost',
      port: port
    }
  })

  proxy.on('proxyRes', (proxyRes, req, res) => {
    if (proxyRes.statusCode === 404) {
      if (req.alternativePaths && req.alternativePaths.length > 0) {
        req.url = req.alternativePaths.shift()
        return proxy.web(req, res, req.proxyOptions)
      }
      if (req.proxyOptions && req.proxyOptions.match) {
        return serveRedirect(req, res, handlers, req.proxyOptions.match, req.proxyOptions)
      }
    }
    res.writeHead(req.proxyOptions.status || proxyRes.statusCode, proxyRes.headers)
    proxyRes.on('data', function(data) {
      res.write(data)
    })
    proxyRes.on('end', function() {
      res.end()
    })
  })

  const handlers = {
    web: (req, res, options) => {
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(req.url)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    ws: (req, socket, head) => proxy.ws(req, socket, head)
  }

  return handlers
}

async function startProxy(settings, addonUrls, configPath) {
  try {
    await waitPort({ port: settings.proxyPort })
  } catch(err) {
    console.error(NETLIFYDEVERR, `Netlify Dev doesn't know what port your site is running on.`)
    console.error(NETLIFYDEVERR, `Please set --targetPort.`)
    this.exit(1)
  }

  if (settings.functionsPort) {
    await waitPort({ port: settings.functionsPort })
  }
  const port = await getPort({ port: settings.port || 8888 })
  const functionsServer = settings.functionsPort ? `http://localhost:${settings.functionsPort}` : null

  const proxy = initializeProxy(settings.proxyPort)

  const rewriter = createRewriter({
    publicFolder: settings.dist,
    jwtRole: settings.jwtRolePath,
    configPath,
  })

  const server = http.createServer(function(req, res) {
    if (isFunction(settings.functionsPort, req)) {
      return proxy.web(req, res, { target: functionsServer })
    }
    let urlForAddons = addonUrl(addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    rewriter(req, res, match => {
      const options = {
        match,
        addonUrls,
        target: `http://localhost:${settings.proxyPort}`,
        publicFolder: settings.dist,
        functionsServer,
        functionsPort: settings.functionsPort,
        jwtRolePath: settings.jwtRolePath
      }

      if (match) return serveRedirect(req, res, proxy, match, options)

      proxy.web(req, res, options)
    })
  })

  server.on('upgrade', function(req, socket, head) {
    proxy.ws(req, socket, head)
  })

  server.listen(port)
  return { url: `http://localhost:${port}`, port }
}

function serveRedirect(req, res, proxy, match, options) {
  if (!match) return proxy.web(req, res, options)

  options = options || req.proxyOptions || {}
  options.match = null

  if (!isEmpty(match.proxyHeaders)) {
    Object.entries(match.proxyHeaders).forEach(([k, v]) => (req.headers[k] = v))
  }

  if (isFunction(options.functionsPort, req)) {
    return proxy.web(req, res, { target: options.functionsServer })
  }
  const urlForAddons = addonUrl(options.addonUrls, req)
  if (urlForAddons) {
    return proxy.web(req, res, { target: urlForAddons })
  }

  if (match.exceptions && match.exceptions.JWT) {
    // Some values of JWT can start with :, so, make sure to normalize them
    const expectedRoles = match.exceptions.JWT.split(',').map(r => (r.startsWith(':') ? r.slice(1) : r))

    const cookieValues = cookie.parse(req.headers.cookie || '')
    const token = cookieValues['nf_jwt']

    // Serve not found by default
    const originalURL = req.url
    req.url = '/.netlify/non-existent-path'

    if (token) {
      let jwtValue = {}
      try {
        jwtValue = jwtDecode(token) || {}
      } catch (err) {
        console.warn(NETLIFYDEVWARN, 'Error while decoding JWT provided in request', err.message)
        res.writeHead(400)
        res.end('Invalid JWT provided. Please see logs for more info.')
        return
      }

      if ((jwtValue.exp || 0) < Math.round(new Date().getTime() / 1000)) {
        console.warn(NETLIFYDEVWARN, 'Expired JWT provided in request', req.url)
      } else {
        const presentedRoles = get(jwtValue, options.jwtRolePath) || []
        if (!Array.isArray(presentedRoles)) {
          console.warn(NETLIFYDEVWARN, `Invalid roles value provided in JWT ${options.jwtRolePath}`, presentedRoles)
          res.writeHead(400)
          res.end('Invalid JWT provided. Please see logs for more info.')
          return
        }

        // Restore the URL if everything is correct
        if (presentedRoles.some(pr => expectedRoles.includes(pr))) {
          req.url = originalURL
        }
      }
    }
  }

  const reqUrl = new url.URL(
    req.url,
    `${req.protocol || (req.headers.scheme && req.headers.scheme + ':') || 'http:'}//${req.headers['host'] ||
      req.hostname}`
  )
  if (match.force404) {
    res.writeHead(404)
    return render404(options.publicFolder)
  }

  if (match.force || (notStatic(reqUrl.pathname, options.publicFolder) && match.status !== 404)) {
    const dest = new url.URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)
    if (isRedirect(match)) {
      res.writeHead(match.status, {
        Location: match.to,
        'Cache-Control': 'no-cache'
      })
      res.end(`Redirecting to ${match.to}`)
      return
    }

    if (isExternal(match)) {
      console.log(`${NETLIFYDEVLOG} Proxying to `, match.to)
      const handler = proxyMiddleware({
        target: `${dest.protocol}//${dest.host}`,
        changeOrigin: true,
        pathRewrite: (path, req) => match.to.replace(/https?:\/\/[^/]+/, '')
      })
      return handler(req, res, {})
    }

    const urlParams = new URLSearchParams(reqUrl.searchParams)
    dest.searchParams.forEach((val, key) => urlParams.set(key, val))
    req.url = dest.pathname + (urlParams.toString() && '?' + urlParams.toString())
    console.log(`${NETLIFYDEVLOG} Rewrote URL to `, req.url)

    if (isFunction({ functionsPort: options.functionsPort }, req)) {
      req.headers['x-netlify-original-pathname'] = reqUrl.pathname
      return proxy.web(req, res, { target: options.functionsServer })
    }
    const urlForAddons = addonUrl(options.addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    return proxy.web(req, res, Object.assign({}, options, { status: match.status }))
  }

  return proxy.web(req, res, options)
}

function startDevServer(settings, log) {
  if (settings.noCmd) {
    const StaticServer = require('static-server')

    const server = new StaticServer({
      rootPath: settings.dist,
      name: 'netlify-dev',
      port: settings.proxyPort,
      templates: {
        notFound: '404.html'
      }
    })

    server.start(function() {
      log(`\n${NETLIFYDEVLOG} Server listening to`, settings.proxyPort)
    })
    return
  }

  let envConfig = {}
  if (fs.existsSync('.env')) {
    envConfig = dotenv.parse(fs.readFileSync('.env'))
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.type}`)
  const args = settings.command === 'npm' ? ['run', ...settings.args] : settings.args
  const ps = child_process.spawn(settings.command, args, {
    env: { ...process.env, ...settings.env, FORCE_COLOR: 'true', ...envConfig },
    stdio: settings.stdio || 'inherit',
    detached: true,
    shell: true,
  })
  if (ps.stdout) ps.stdout.on('data', buff => process.stdout.write(buff.toString('utf8')))
  if (ps.stderr) ps.stderr.on('data', buff => process.stderr.write(buff.toString('utf8')))
  ps.on('close', code => process.exit(code))
  ps.on('SIGINT', process.exit)
  ps.on('SIGTERM', process.exit);

  ['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach(signal => process.on(signal, () => {
      try {
        process.kill(-ps.pid)
      } catch (err) {
        console.error(`${NETLIFYDEVERR} Error while killing child process: ${err.message}`)
      }
      process.exit()
    }))

  return ps
}

class DevCommand extends Command {
  async run() {
    this.log(`${NETLIFYDEV}`)
    let { flags } = this.parse(DevCommand)
    const { api, site, config } = this.netlify
    const functionsDir =
        flags.functions ||
        (config.dev && config.dev.functions) ||
        (config.build && config.build.functions) ||
        flags.Functions ||
        (config.dev && config.dev.Functions) ||
        (config.build && config.build.Functions)
    let addonUrls = {}

    let accessToken = api.accessToken
    if (site.id && !flags.offline) {
      const { addEnvVariables } = require('../../utils/dev')
      addonUrls = await addEnvVariables(api, site, accessToken)
    }
    process.env.NETLIFY_DEV = 'true'

    let settings = await serverSettings(Object.assign({}, config.dev, flags))

    if (!settings.proxyPort) {
      settings.proxyPort = config.dev && config.dev.proxyPort || 8080 // in case detector is bypassed
    }

    if (flags.dir || !(settings && settings.command)) {
      let dist
      if (flags.dir) {
        this.log(`${NETLIFYDEVWARN} Using simple static server because --dir flag was specified`)
        dist = flags.dir
      } else {
        this.log(`${NETLIFYDEVWARN} No dev server detected, using simple static server`)
        dist = (config.dev && config.dev.publish) ||
            (config.build && !isNetlifyDir(config.build.publish, site.root) && config.build.publish)
      }
      if (!dist) {
        this.log(`${NETLIFYDEVLOG} Using current working directory`)
        this.log(`${NETLIFYDEVWARN} Unable to determine public folder to serve files from.`)
        this.log(
            `${NETLIFYDEVWARN} Setup a netlify.toml file with a [dev] section to specify your dev server settings.`
        )
        this.log(
            `${NETLIFYDEVWARN} See docs at: https://github.com/netlify/cli/blob/master/docs/netlify-dev.md#project-detection`
        )
        this.log(`${NETLIFYDEVWARN} Using current working directory for now...`)
        dist = process.cwd()
      }
      settings = {
        noCmd: true,
        port: 8888,
        proxyPort: await getPort({ port: 3999 }),
        dist,
        jwtRolePath: config.dev && config.dev.jwtRolePath
      }
    }
    if (!settings.jwtRolePath) settings.jwtRolePath = 'app_metadata.authorization.roles'

    startDevServer(settings, this.log)

    // serve functions from zip-it-and-ship-it
    // env variables relies on `url`, careful moving this code
    if (functionsDir) {
      const functionBuilder = await detectFunctionsBuilder(settings)
      if (functionBuilder) {
        this.log(
          `${NETLIFYDEVLOG} Function builder ${chalk.yellow(
            functionBuilder.builderName
          )} detected: Running npm script ${chalk.yellow(functionBuilder.npmScript)}`
        )
        this.warn(
          `${NETLIFYDEVWARN} This is a beta feature, please give us feedback on how to improve at https://github.com/netlify/cli/`
        )
        await functionBuilder.build()
        const functionWatcher = chokidar.watch(functionBuilder.src)
        functionWatcher.on('add', functionBuilder.build)
        functionWatcher.on('change', functionBuilder.build)
        functionWatcher.on('unlink', functionBuilder.build)
      }
      const functionsPort = await getPort({ port: settings.functionsPort || 34567 })
      settings.functionsPort = functionsPort

      await serveFunctions({
        ...settings,
        functionsDir
      })
    }

    let { url, port } = await startProxy(settings, addonUrls, site.configPath)
    if (!url) {
      throw new Error('Unable to start proxy server')
    }

    if (flags.live) {
      await waitPort({ port })
      const liveSession = await createTunnel(site.id, accessToken, this.log)
      url = liveSession.session_url
      process.env.BASE_URL = url

      await connectTunnel(liveSession, accessToken, port, this.log)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev',
        projectType: settings.type || 'custom',
        live: flags.live || false
      }
    })

    if (
      isEmpty(config.dev) ||
      !config.dev.hasOwnProperty('autoLaunch') ||
      (config.dev.hasOwnProperty('autoLaunch') && config.dev.autoLaunch !== false)
    ) {
      try {
        await open(url)
      } catch (err) {
        console.warn(NETLIFYDEVWARN, 'Error while opening dev server URL in browser', err.message)
      }
    }

    // boxen doesnt support text wrapping yet https://github.com/sindresorhus/boxen/issues/16
    const banner = require('wrap-ansi')(chalk.bold(`${NETLIFYDEVLOG} Server now ready on ${url}`), 70)
    process.env.URL = url
    process.env.DEPLOY_URL = process.env.URL

    this.log(
      boxen(banner, {
        padding: 1,
        margin: 1,
        align: 'center',
        borderColor: '#00c7b7'
      })
    )
  }
}

DevCommand.description = `Local dev server
The dev command will run a local dev server with Netlify's proxy and redirect rules
`

DevCommand.examples = ['$ netlify dev', '$ netlify dev -c "yarn start"', '$ netlify dev -c hugo']

DevCommand.strict = false

DevCommand.flags = {
  command: flags.string({
    char: 'c',
    description: 'command to run'
  }),
  port: flags.integer({
    char: 'p',
    description: 'port of netlify dev'
  }),
  functionsPort: flags.integer({
    description: 'port for functions server'
  }),
  targetPort: flags.integer({
    description: 'port of target app server'
  }),
  dir: flags.string({
    char: 'd',
    description: 'dir with static files'
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to serve'
  }),
  offline: flags.boolean({
    char: 'o',
    description: 'disables any features that require network access'
  }),
  live: flags.boolean({
    char: 'l',
    description: 'Start a public live session'
  })
}

module.exports = DevCommand
