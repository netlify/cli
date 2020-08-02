const url = require('url')
const util = require('util')
const { URLSearchParams } = require('url')
const path = require('path')
const fs = require('fs')
const { flags } = require('@oclif/command')
const child_process = require('child_process')
const http = require('http')
const httpProxy = require('http-proxy')
const waitPort = require('wait-port')
const stripAnsiCc = require('strip-ansi-control-characters')
const which = require('which')
const chokidar = require('chokidar')
const debounce = require('lodash.debounce')
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
const contentType = require('content-type')
const { NETLIFYDEV, NETLIFYDEVLOG, NETLIFYDEVWARN, NETLIFYDEVERR } = require('../../utils/logo')
const boxen = require('boxen')
const { createTunnel, connectTunnel } = require('../../utils/live-tunnel')
const { createRewriter } = require('../../utils/rules-proxy')
const { onChanges } = require('../../utils/rules-proxy')
const { parseHeadersFile, objectForPath } = require('../../utils/headers')
const { getEnvSettings } = require('../../utils/env')
const { createStreamPromise } = require('../../utils/create-stream-promise')

const stat = util.promisify(fs.stat)

function isInternal(url) {
  return url.startsWith('/.netlify/')
}
function isFunction(functionsPort, url) {
  return functionsPort && url.match(/^\/.netlify\/functions\/.+/)
}

function addonUrl(addonUrls, req) {
  const m = req.url.match(/^\/.netlify\/([^\/]+)(\/.*)/) // eslint-disable-line no-useless-escape
  const addonUrl = m && addonUrls[m[1]]
  return addonUrl ? `${addonUrl}${m[2]}` : null
}

async function getStatic(pathname, publicFolder) {
  const alternatives = [pathname, ...alternativePathsFor(pathname)].map(p => path.resolve(publicFolder, p.substr(1)))

  for (const i in alternatives) {
    const p = alternatives[i]
    try {
      const pathStats = await stat(p)
      if (pathStats.isFile()) return '/' + path.relative(publicFolder, p)
    } catch (err) {
      // Ignore
    }
  }
  return false
}

function isExternal(match) {
  return match.to && match.to.match(/^https?:\/\//)
}

function isRedirect(match) {
  return match.status && match.status >= 300 && match.status <= 400
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

function initializeProxy(port, distDir, projectDir) {
  const proxy = httpProxy.createProxyServer({
    selfHandleResponse: true,
    target: {
      host: 'localhost',
      port,
    },
  })

  const headersFiles = Array.from(new Set([path.resolve(projectDir, '_headers'), path.resolve(distDir, '_headers')]))

  let headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  onChanges(headersFiles, () => {
    console.log(
      `${NETLIFYDEVLOG} Reloading headers files`,
      headersFiles.filter(fs.existsSync).map(p => path.relative(projectDir, p))
    )
    headerRules = headersFiles.reduce((prev, curr) => Object.assign(prev, parseHeadersFile(curr)), {})
  })

  proxy.on('error', err => console.error('error while proxying request:', err.message))
  proxy.on('proxyReq', (proxyReq, req) => {
    if (req.originalBody) {
      proxyReq.write(req.originalBody)
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
    const requestURL = new url.URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathHeaderRules = objectForPath(headerRules, requestURL.pathname)
    if (!isEmpty(pathHeaderRules)) {
      Object.entries(pathHeaderRules).forEach(([key, val]) => res.setHeader(key, val))
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
      const requestURL = new url.URL(req.url, 'http://localhost')
      req.proxyOptions = options
      req.alternativePaths = alternativePathsFor(requestURL.pathname).map(p => p + requestURL.search)
      // Ref: https://nodejs.org/api/net.html#net_socket_remoteaddress
      req.headers['x-forwarded-for'] = req.connection.remoteAddress || ''
      return proxy.web(req, res, options)
    },
    ws: (req, socket, head) => proxy.ws(req, socket, head),
  }

  return handlers
}

async function startProxy(settings = {}, addonUrls, configPath, projectDir, functionsDir, exit) {
  try {
    await waitPort({ port: settings.frameworkPort, output: 'silent' })
  } catch (err) {
    console.error(NETLIFYDEVERR, `Netlify Dev could not connect to localhost:${settings.port}.`)
    console.error(NETLIFYDEVERR, `Please make sure your framework server is running on port ${settings.port}`)
    exit(1)
  }

  if (functionsDir && settings.functionsPort) {
    await waitPort({ port: settings.functionsPort, output: 'silent' })
  }
  const functionsServer = settings.functionsPort ? `http://localhost:${settings.functionsPort}` : null

  const proxy = initializeProxy(settings.frameworkPort, settings.dist, projectDir)

  const rewriter = await createRewriter({
    distDir: settings.dist,
    jwtRole: settings.jwtRolePath,
    configPath,
    projectDir,
  })

  const server = http.createServer(async function(req, res) {
    req.originalBody = ['GET', 'OPTIONS', 'HEAD'].includes(req.method) ? null : await createStreamPromise(req, 30)

    if (isFunction(settings.functionsPort, req.url)) {
      return proxy.web(req, res, { target: functionsServer })
    }
    const urlForAddons = addonUrl(addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    rewriter(req, res, match => {
      const options = {
        match,
        addonUrls,
        target: `http://localhost:${settings.frameworkPort}`,
        publicFolder: settings.dist,
        functionsServer,
        functionsPort: settings.functionsPort,
        jwtRolePath: settings.jwtRolePath,
        framework: settings.framework,
      }

      if (match) return serveRedirect(req, res, proxy, match, options)

      const ct = req.headers['content-type'] ? contentType.parse(req) : {}
      if (
        req.method === 'POST' &&
        !isInternal(req.url) &&
        (ct.type.endsWith('/x-www-form-urlencoded') || ct.type === 'multipart/form-data')
      ) {
        return proxy.web(req, res, { target: functionsServer })
      }

      proxy.web(req, res, options)
    })
  })

  server.on('upgrade', function(req, socket, head) {
    proxy.ws(req, socket, head)
  })

  server.listen(settings.port)
  return { url: `http://localhost:${settings.port}`, port: settings.port }
}

async function serveRedirect(req, res, proxy, match, options) {
  if (!match) return proxy.web(req, res, options)

  options = options || req.proxyOptions || {}
  options.match = null

  if (!isEmpty(match.proxyHeaders)) {
    Object.entries(match.proxyHeaders).forEach(([k, v]) => (req.headers[k] = v))
  }

  if (isFunction(options.functionsPort, req.url)) {
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

  const staticFile = await getStatic(reqUrl.pathname, options.publicFolder)
  if (staticFile) req.url = staticFile + reqUrl.search
  if (match.force404) {
    res.writeHead(404)
    return render404(options.publicFolder)
  }

  if (match.force || !staticFile || !options.framework || req.method === 'POST') {
    const dest = new url.URL(match.to, `${reqUrl.protocol}//${reqUrl.host}`)

    // Use query params of request URL as base, so that, destination query params can supersede
    const urlParams = new URLSearchParams(reqUrl.searchParams)
    dest.searchParams.forEach((val, key) => urlParams.set(key, val))
    urlParams.forEach((val, key) => dest.searchParams.set(key, val))

    // Get the URL after http://host:port
    const destURL = dest.toString().replace(dest.origin, '')

    if (isRedirect(match)) {
      res.writeHead(match.status, {
        'Location': match.to,
        'Cache-Control': 'no-cache',
      })
      res.end(`Redirecting to ${match.to}`)
      return
    }

    if (isExternal(match)) {
      console.log(`${NETLIFYDEVLOG} Proxying to `, dest.toString())
      const handler = proxyMiddleware({
        target: `${dest.protocol}//${dest.host}`,
        changeOrigin: true,
        pathRewrite: (path, req) => destURL.replace(/https?:\/\/[^/]+/, ''),
      })
      return handler(req, res, {})
    }

    const ct = req.headers['content-type'] ? contentType.parse(req) : {}
    if (
      req.method === 'POST' &&
      !isInternal(req.url) &&
      !isInternal(destURL) &&
      (ct.type.endsWith('/x-www-form-urlencoded') || ct.type === 'multipart/form-data')
    ) {
      return proxy.web(req, res, { target: options.functionsServer })
    }

    const destStaticFile = await getStatic(dest.pathname, options.publicFolder)
    let status
    if (match.force || (!staticFile && ((!options.framework && destStaticFile) || isInternal(destURL)))) {
      req.url = destStaticFile ? destStaticFile + dest.search : destURL
      status = match.status
      console.log(`${NETLIFYDEVLOG} Rewrote URL to`, req.url)
    }

    if (isFunction(options.functionsPort, req.url)) {
      req.headers['x-netlify-original-pathname'] = reqUrl.pathname
      return proxy.web(req, res, { target: options.functionsServer })
    }
    const urlForAddons = addonUrl(options.addonUrls, req)
    if (urlForAddons) {
      return proxy.web(req, res, { target: urlForAddons })
    }

    return proxy.web(req, res, { ...options, status })
  }

  return proxy.web(req, res, options)
}

async function startDevServer(settings, log) {
  if (settings.noCmd) {
    const StaticServer = require('static-server')

    const server = new StaticServer({
      rootPath: settings.dist,
      name: 'netlify-dev',
      port: settings.frameworkPort,
      templates: {
        notFound: '404.html',
      },
    })

    server.start(function() {
      log(`\n${NETLIFYDEVLOG} Server listening to`, settings.frameworkPort)
    })
    return
  }

  log(`${NETLIFYDEVLOG} Starting Netlify Dev with ${settings.framework || 'custom config'}`)
  const commandBin = await which(settings.command).catch(err => {
    if (err.code === 'ENOENT') {
      throw new Error(
        `"${settings.command}" could not be found in your PATH. Please make sure that "${settings.command}" is installed and available in your PATH`
      )
    }
    throw err
  })
  const ps = child_process.spawn(commandBin, settings.args, {
    env: { ...process.env, ...settings.env, FORCE_COLOR: 'true' },
    stdio: 'pipe',
  })

  ps.stdout.pipe(stripAnsiCc.stream()).pipe(process.stdout)
  ps.stderr.pipe(stripAnsiCc.stream()).pipe(process.stderr)

  process.stdin.pipe(process.stdin)

  function handleProcessExit(code) {
    log(
      code > 0 ? NETLIFYDEVERR : NETLIFYDEVWARN,
      `"${[settings.command, ...settings.args].join(' ')}" exited with code ${code}. Shutting down Netlify Dev server`
    )
    process.exit(code)
  }
  ps.on('close', handleProcessExit)
  ps.on('SIGINT', handleProcessExit)
  ps.on('SIGTERM', handleProcessExit)
  ;['SIGINT', 'SIGTERM', 'SIGQUIT', 'SIGHUP', 'exit'].forEach(signal =>
    process.on(signal, () => {
      try {
        process.kill(-ps.pid)
      } catch (err) {
        // Ignore
      }
      process.exit()
    })
  )

  return ps
}

const getBuildFunction = functionBuilder =>
  async function build() {
    this.log(
      `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.magenta(
        'building'
      )} functions from directory ${chalk.yellow(functionBuilder.src)}`
    )

    try {
      await functionBuilder.build()
      this.log(
        `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.green(
          'finished'
        )} building functions from directory ${chalk.yellow(functionBuilder.src)}`
      )
    } catch (error) {
      const errorMessage = (error.stderr && error.stderr.toString()) || error.message
      this.log(
        `${NETLIFYDEVLOG} Function builder ${chalk.yellow(functionBuilder.builderName)} ${chalk.red(
          'failed'
        )} building functions from directory ${chalk.yellow(functionBuilder.src)}${
          errorMessage ? ` with error:\n${errorMessage}` : ''
        }`
      )
    }
  }

class DevCommand extends Command {
  async run() {
    this.log(`${NETLIFYDEV}`)
    const errorExit = this.error
    const log = this.log
    const { flags } = this.parse(DevCommand)
    const { api, site, config } = this.netlify
    config.dev = { ...config.dev }
    config.build = { ...config.build }
    const devConfig = {
      framework: '#auto',
      ...(config.build.functions && { functions: config.build.functions }),
      ...(config.build.publish && { publish: config.build.publish }),
      ...config.dev,
      ...flags,
    }
    let addonUrls = {}

    const accessToken = api.accessToken
    if (site.id && !flags.offline) {
      const { addEnvVariables } = require('../../utils/dev')
      addonUrls = await addEnvVariables(api, site, accessToken)
    }

    process.env.NETLIFY_DEV = 'true'
    // Override env variables with .env file
    const envSettings = await getEnvSettings(site.root)
    if (envSettings.file) {
      console.log(
        `${NETLIFYDEVLOG} Overriding the following env variables with ${chalk.blue(
          path.relative(site.root, envSettings.file)
        )} file:`,
        chalk.yellow(Object.keys(envSettings.vars))
      )
      Object.entries(envSettings.vars).forEach(([key, val]) => (process.env[key] = val))
    }

    let settings = {}
    try {
      settings = await serverSettings(devConfig, flags, site.root, this.log)
    } catch (err) {
      this.log(NETLIFYDEVERR, err.message)
      this.exit(1)
    }

    await startDevServer(settings, this.log)

    // serve functions from zip-it-and-ship-it
    // env variables relies on `url`, careful moving this code
    if (settings.functions) {
      const functionBuilder = await detectFunctionsBuilder(site.root)
      if (functionBuilder) {
        this.log(
          `${NETLIFYDEVLOG} Function builder ${chalk.yellow(
            functionBuilder.builderName
          )} detected: Running npm script ${chalk.yellow(functionBuilder.npmScript)}`
        )
        this.warn(
          `${NETLIFYDEVWARN} This is a beta feature, please give us feedback on how to improve at https://github.com/netlify/cli/`
        )

        const debouncedBuild = debounce(getBuildFunction(functionBuilder).bind(this), 300, {
          leading: true,
          trailing: true,
        })

        await debouncedBuild()

        const functionWatcher = chokidar.watch(functionBuilder.src)
        functionWatcher.on('ready', () => {
          functionWatcher.on('add', debouncedBuild)
          functionWatcher.on('change', debouncedBuild)
          functionWatcher.on('unlink', debouncedBuild)
        })
      }

      const functionsServer = await serveFunctions(settings.functions, this.netlify.cachedConfig.siteInfo)
      functionsServer.listen(settings.functionsPort, function(err) {
        if (err) {
          errorExit(`${NETLIFYDEVERR} Unable to start lambda server: ${err}`)
        }

        // add newline because this often appears alongside the client devserver's output
        log(`\n${NETLIFYDEVLOG} Functions server is listening on ${settings.functionsPort}`)
      })
    }

    let { url } = await startProxy(settings, addonUrls, site.configPath, site.root, settings.functions, this.exit)
    if (!url) {
      throw new Error('Unable to start proxy server')
    }

    if (flags.live) {
      await waitPort({ port: settings.frameworkPort, output: 'silent' })
      const liveSession = await createTunnel(site.id, accessToken, this.log)
      url = liveSession.session_url
      process.env.BASE_URL = url

      await connectTunnel(liveSession, accessToken, settings.port, this.log)
    }

    await this.config.runHook('analytics', {
      eventName: 'command',
      payload: {
        command: 'dev',
        projectType: settings.framework || 'custom',
        live: flags.live || false,
      },
    })

    if (devConfig.autoLaunch && devConfig.autoLaunch !== false) {
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
        borderColor: '#00c7b7',
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
  ...DevCommand.flags,
  command: flags.string({
    char: 'c',
    description: 'command to run',
  }),
  port: flags.integer({
    char: 'p',
    description: 'port of netlify dev',
  }),
  targetPort: flags.integer({
    description: 'port of target app server',
  }),
  dir: flags.string({
    char: 'd',
    description: 'dir with static files',
  }),
  functions: flags.string({
    char: 'f',
    description: 'Specify a functions folder to serve',
  }),
  offline: flags.boolean({
    char: 'o',
    description: 'disables any features that require network access',
  }),
  live: flags.boolean({
    char: 'l',
    description: 'Start a public live session',
  }),
}

module.exports = DevCommand
