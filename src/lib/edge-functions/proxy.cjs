// @ts-check
const { Buffer } = require('buffer')
const { relative } = require('path')
const { cwd, env } = require('process')

const getAvailablePort = require('get-port')
const { v4: generateUUID } = require('uuid')

const { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error: printError, log } = require('../../utils/command-helpers.cjs')
const { getGeoLocation } = require('../geo-location.cjs')
const { getPathInProject } = require('../settings.cjs')
const { startSpinner, stopSpinner } = require('../spinner.cjs')

const { DIST_IMPORT_MAP_PATH } = require('./consts.cjs')
const headers = require('./headers.cjs')
const { getInternalFunctions } = require('./internal.cjs')
const { EdgeFunctionsRegistry } = require('./registry.cjs')

const headersSymbol = Symbol('Edge Functions Headers')

const LOCAL_HOST = '127.0.0.1'

const getDownloadUpdateFunctions = () => {
  let spinner

  /**
   * @param {Error=} error_
   */
  const onAfterDownload = (error_) => {
    stopSpinner({ error: Boolean(error_), spinner })
  }

  const onBeforeDownload = () => {
    spinner = startSpinner({ text: 'Setting up the Edge Functions environment. This may take a couple of minutes.' })
  }

  return {
    onAfterDownload,
    onBeforeDownload,
  }
}

const handleProxyRequest = (req, proxyReq) => {
  Object.entries(req[headersSymbol]).forEach(([header, value]) => {
    proxyReq.setHeader(header, value)
  })
}

const createSiteInfoHeader = (siteInfo = {}) => {
  const { id, name, url } = siteInfo
  const site = { id, name, url }
  const siteString = JSON.stringify(site)
  return Buffer.from(siteString).toString('base64')
}

const initializeProxy = async ({
  config,
  configPath,
  env: configEnv,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  settings,
  siteInfo,
  state,
}) => {
  const { functions: internalFunctions, importMap, path: internalFunctionsPath } = await getInternalFunctions()
  const { port: mainPort } = settings
  const userFunctionsPath = config.build.edge_functions
  const isolatePort = await getAvailablePort()

  // Initializes the server, bootstrapping the Deno CLI and downloading it from
  // the network if needed. We don't want to wait for that to be completed, or
  // the command will be left hanging.
  const server = prepareServer({
    certificatePath: settings.https ? settings.https.certFilePath : undefined,
    config,
    configPath,
    directories: [internalFunctionsPath, userFunctionsPath].filter(Boolean),
    env: configEnv,
    getUpdatedConfig,
    importMaps: [importMap].filter(Boolean),
    inspectSettings,
    internalFunctions,
    port: isolatePort,
    projectDir,
  })
  const hasEdgeFunctions = userFunctionsPath !== undefined || internalFunctions.length !== 0

  return async (req) => {
    const [geoLocation, registry] = await Promise.all([
      getGeoLocation({ mode: geolocationMode, geoCountry, offline, state }),
      server,
    ])

    if (!registry) return

    await registry.initialize()

    const url = new URL(req.url, `http://${LOCAL_HOST}:${mainPort}`)
    const {
      functionNames: { allFunctions, postCacheFunctions, preCacheFunctions },
      orphanedDeclarations,
    } = await registry.matchURLPath(url.pathname)
    let isPostCacheFunction = false

    // We only have edge functions with caching
    if (preCacheFunctions.length === 0 && postCacheFunctions.length >= 0) {
      isPostCacheFunction = true
    }
    if ((req.headers[headers.Passthrough] !== undefined && postCacheFunctions.length === 0) || !hasEdgeFunctions) {
      return
    }
    // We get a passthrough header but there are edge functions with caching
    if (req.headers[headers.Passthrough] !== undefined && postCacheFunctions.length >= 0) {
      isPostCacheFunction = true
    }

    // Setting header with geolocation and site info.
    req.headers[headers.Geo] = JSON.stringify(geoLocation)
    req.headers[headers.Site] = createSiteInfoHeader(siteInfo)

    // If the request matches a config declaration for an Edge Function without
    // a matching function file, we warn the user.
    orphanedDeclarations.forEach((functionName) => {
      log(
        `${NETLIFYDEVWARN} Request to ${chalk.yellow(
          url.pathname,
        )} matches declaration for edge function ${chalk.yellow(
          functionName,
        )}, but there's no matching function file in ${chalk.yellow(
          relative(cwd(), userFunctionsPath),
        )}. Please visit ${chalk.blue('https://ntl.fyi/edge-create')} for more information.`,
      )
    })

    if (allFunctions.length === 0) {
      return
    }

    // if the current edge function has no caching, we only sent pre-cache edge functions
    // if the current edge function has caching, we only sent a list of that function.
    req[headersSymbol] = {
      [headers.Functions]: isPostCacheFunction ? postCacheFunctions.join(',') : preCacheFunctions.join(','),
      [headers.ForwardedHost]: `localhost:${mainPort}`,
      // we only need passthrough for edge functions without caching
      ...(!isPostCacheFunction && { [headers.Passthrough]: 'passthrough' }),
      [headers.RequestID]: generateUUID(),
      [headers.IP]: LOCAL_HOST,
    }

    if (settings.https) {
      req[headersSymbol][headers.ForwardedProtocol] = 'https'
    }

    return `http://${LOCAL_HOST}:${isolatePort}`
  }
}

const isEdgeFunctionsRequest = (req) => req[headersSymbol] !== undefined

const prepareServer = async ({
  certificatePath,
  config,
  configPath,
  directories,
  env: configEnv,
  getUpdatedConfig,
  importMaps,
  inspectSettings,
  internalFunctions,
  port,
  projectDir,
}) => {
  try {
    const bundler = await import('@netlify/edge-bundler')
    const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
    const runIsolate = await bundler.serve({
      ...getDownloadUpdateFunctions(),
      certificatePath,
      debug: env.NETLIFY_DENO_DEBUG === 'true',
      distImportMapPath,
      formatExportTypeError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(
          name,
        )}. The file does not seem to have a function as the default export.`,
      formatImportError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to run Edge Function ${chalk.yellow(name)}:`,
      importMaps,
      inspectSettings,
      port,
    })
    const registry = new EdgeFunctionsRegistry({
      bundler,
      config,
      configPath,
      directories,
      env: configEnv,
      getUpdatedConfig,
      internalFunctions,
      projectDir,
      runIsolate,
    })

    return registry
  } catch (error) {
    printError(error.message, { exit: false })
  }
}

module.exports = { handleProxyRequest, initializeProxy, isEdgeFunctionsRequest, createSiteInfoHeader }
