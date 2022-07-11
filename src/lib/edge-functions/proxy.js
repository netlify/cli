// @ts-check
const { relative } = require('path')
const { cwd, env } = require('process')

const getAvailablePort = require('get-port')
const { v4: generateUUID } = require('uuid')

const { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error: printError, log } = require('../../utils/command-helpers')
const { getGeoLocation } = require('../geo-location')
const { getPathInProject } = require('../settings')
const { startSpinner, stopSpinner } = require('../spinner')

const { DIST_IMPORT_MAP_PATH } = require('./consts')
const headers = require('./headers')
const { getInternalFunctions } = require('./internal')
const { EdgeFunctionsRegistry } = require('./registry')

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

const initializeProxy = async ({
  config,
  configPath,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  offline,
  projectDir,
  settings,
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
    getUpdatedConfig,
    importMaps: [importMap].filter(Boolean),
    inspectSettings,
    internalFunctions,
    port: isolatePort,
    projectDir,
  })
  const hasEdgeFunctions = userFunctionsPath !== undefined || internalFunctions.length !== 0

  return async (req) => {
    if (req.headers[headers.Passthrough] !== undefined || !hasEdgeFunctions) {
      return
    }

    const [geoLocation, registry] = await Promise.all([
      getGeoLocation({ mode: geolocationMode, offline, state }),
      server,
    ])

    if (!registry) return

    // Setting header with geolocation.
    req.headers[headers.Geo] = JSON.stringify(geoLocation)

    await registry.initialize()

    const url = new URL(req.url, `http://${LOCAL_HOST}:${mainPort}`)
    const { functionNames, orphanedDeclarations } = await registry.matchURLPath(url.pathname)

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

    if (functionNames.length === 0) {
      return
    }

    req[headersSymbol] = {
      [headers.Functions]: functionNames.join(','),
      [headers.ForwardedHost]: `localhost:${mainPort}`,
      [headers.Passthrough]: 'passthrough',
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

module.exports = { handleProxyRequest, initializeProxy, isEdgeFunctionsRequest }
