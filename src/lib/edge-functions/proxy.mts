// @ts-check

const { Buffer } = require('buffer')

const { relative } = require('path')

const { cwd, env } = require('process')

import getAvailablePort from 'get-port'
const { v4: generateUUID } = require('uuid')


const { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error: printError, log } = require('../../utils/command-helpers.mjs')

const { getGeoLocation } = require('../geo-location.mjs')

const { getPathInProject } = require('../settings.mjs')

const { startSpinner, stopSpinner } = require('../spinner.mjs')


const { DIST_IMPORT_MAP_PATH } = require('./consts.mjs')
import headers from './headers.mjs'

const { getInternalFunctions } = require('./internal.mjs')

const { EdgeFunctionsRegistry } = require('./registry.mjs')

const headersSymbol = Symbol('Edge Functions Headers')

const LOCAL_HOST = '127.0.0.1'

const getDownloadUpdateFunctions = () => {
  
  let spinner: $TSFixMe

  /**
   * @param {Error=} error_
   */
  
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

}: $TSFixMe) => {
  try {
    const bundler = await import('@netlify/edge-bundler')
    const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
    const runIsolate = await bundler.serve({
      ...getDownloadUpdateFunctions(),
      certificatePath,
      debug: env.NETLIFY_DENO_DEBUG === 'true',
      distImportMapPath,
      
      formatExportTypeError: (name: $TSFixMe) => `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(
        name,
      )}. The file does not seem to have a function as the default export.`,
      
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
    
    printError((error as $TSFixMe).message, { exit: false });
  }
}

export default { handleProxyRequest, initializeProxy, isEdgeFunctionsRequest, createSiteInfoHeader }
