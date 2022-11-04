// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'Buffer'.
const { Buffer } = require('buffer')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'relative'.
const { relative } = require('path')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'cwd'.
const { cwd, env } = require('process')

const getAvailablePort = require('get-port')
const { v4: generateUUID } = require('uuid')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'NETLIFYDEV... Remove this comment to see the full error message
const { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error: printError, log } = require('../../utils/command-helpers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getGeoLoca... Remove this comment to see the full error message
const { getGeoLocation } = require('../geo-location.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../settings.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'startSpinn... Remove this comment to see the full error message
const { startSpinner, stopSpinner } = require('../spinner.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'DIST_IMPOR... Remove this comment to see the full error message
const { DIST_IMPORT_MAP_PATH } = require('./consts.cjs')
const headers = require('./headers.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getInterna... Remove this comment to see the full error message
const { getInternalFunctions } = require('./internal.cjs')
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'EdgeFuncti... Remove this comment to see the full error message
const { EdgeFunctionsRegistry } = require('./registry.cjs')

const headersSymbol = Symbol('Edge Functions Headers')

const LOCAL_HOST = '127.0.0.1'

const getDownloadUpdateFunctions = () => {
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  let spinner: $TSFixMe

  /**
   * @param {Error=} error_
   */
  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  const onAfterDownload = (error_: $TSFixMe) => {
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const handleProxyRequest = (req: $TSFixMe, proxyReq: $TSFixMe) => {
  Object.entries(req[headersSymbol]).forEach(([header, value]) => {
    proxyReq.setHeader(header, value)
  })
}

const createSiteInfoHeader = (siteInfo = {}) => {
  // @ts-expect-error TS(2339): Property 'id' does not exist on type '{}'.
  const { id, name, url } = siteInfo
  const site = { id, name, url }
  const siteString = JSON.stringify(site)
  return Buffer.from(siteString).toString('base64')
}

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'initialize... Remove this comment to see the full error message
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
  state
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
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

  // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
  return async (req: $TSFixMe) => {
    if (req.headers[headers.Passthrough] !== undefined || !hasEdgeFunctions) {
      return
    }

    const [geoLocation, registry] = await Promise.all([
      getGeoLocation({ mode: geolocationMode, geoCountry, offline, state }),
      server,
    ])

    if (!registry) return

    // Setting header with geolocation and site info.
    req.headers[headers.Geo] = JSON.stringify(geoLocation)
    req.headers[headers.Site] = createSiteInfoHeader(siteInfo)

    await registry.initialize()

    const url = new URL(req.url, `http://${LOCAL_HOST}:${mainPort}`)
    const { functionNames, orphanedDeclarations } = await registry.matchURLPath(url.pathname)

    // If the request matches a config declaration for an Edge Function without
    // a matching function file, we warn the user.
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    orphanedDeclarations.forEach((functionName: $TSFixMe) => {
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
  };
}

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isEdgeFunctionsRequest = (req: $TSFixMe) => req[headersSymbol] !== undefined

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
  projectDir
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
}: $TSFixMe) => {
  try {
    const bundler = await import('@netlify/edge-bundler')
    const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
    const runIsolate = await bundler.serve({
      ...getDownloadUpdateFunctions(),
      certificatePath,
      debug: env.NETLIFY_DENO_DEBUG === 'true',
      distImportMapPath,
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      formatExportTypeError: (name: $TSFixMe) => `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(
        name,
      )}. The file does not seem to have a function as the default export.`,
      // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
      formatImportError: (name: $TSFixMe) => `${NETLIFYDEVERR} ${chalk.red('Failed')} to run Edge Function ${chalk.yellow(name)}:`,
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
    // @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
    printError((error as $TSFixMe).message, { exit: false });
  }
}

module.exports = { handleProxyRequest, initializeProxy, isEdgeFunctionsRequest, createSiteInfoHeader }
