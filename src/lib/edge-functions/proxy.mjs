// @ts-check
import { Buffer } from 'buffer'
import { relative } from 'path'
import { cwd, env } from 'process'

import getAvailablePort from 'get-port'

import { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error as printError, log } from '../../utils/command-helpers.mjs'
import { getGeoLocation } from '../geo-location.mjs'
import { getPathInProject } from '../settings.mjs'
import { startSpinner, stopSpinner } from '../spinner.mjs'

import { getBootstrapURL } from './bootstrap.mjs'
import { DIST_IMPORT_MAP_PATH } from './consts.mjs'
import { headers, getFeatureFlagsHeader, getInvocationMetadataHeader } from './headers.mjs'
import { getInternalFunctions } from './internal.mjs'
import { EdgeFunctionsRegistry } from './registry.mjs'

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

export const handleProxyRequest = (req, proxyReq) => {
  Object.entries(req[headersSymbol]).forEach(([header, value]) => {
    proxyReq.setHeader(header, value)
  })
}

export const createSiteInfoHeader = (siteInfo = {}) => {
  const { id, name, url } = siteInfo
  const site = { id, name, url }
  const siteString = JSON.stringify(site)
  return Buffer.from(siteString).toString('base64')
}

export const initializeProxy = async ({
  config,
  configPath,
  debug,
  env: configEnv,
  geoCountry,
  geolocationMode,
  getUpdatedConfig,
  inspectSettings,
  mainPort,
  offline,
  passthroughPort,
  projectDir,
  siteInfo,
  state,
}) => {
  const { functions: internalFunctions, importMap, path: internalFunctionsPath } = await getInternalFunctions()
  const userFunctionsPath = config.build.edge_functions
  const isolatePort = await getAvailablePort()

  // Initializes the server, bootstrapping the Deno CLI and downloading it from
  // the network if needed. We don't want to wait for that to be completed, or
  // the command will be left hanging.
  const server = prepareServer({
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
  const hasEdgeFunctions = userFunctionsPath !== undefined || internalFunctionsPath

  return async (req) => {
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
    const { functionNames, invocationMetadata, orphanedDeclarations } = registry.matchURLPath(url.pathname)

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

    const featureFlags = ['edge_functions_bootstrap_failure_mode']

    req[headersSymbol] = {
      [headers.FeatureFlags]: getFeatureFlagsHeader(featureFlags),
      [headers.ForwardedHost]: `localhost:${passthroughPort}`,
      [headers.Functions]: functionNames.join(','),
      [headers.InvocationMetadata]: getInvocationMetadataHeader(invocationMetadata),
      [headers.IP]: LOCAL_HOST,
      [headers.Passthrough]: 'passthrough',
    }

    if (debug) {
      req[headersSymbol][headers.DebugLogging] = '1'
    }

    return `http://${LOCAL_HOST}:${isolatePort}`
  }
}

export const isEdgeFunctionsRequest = (req) => req[headersSymbol] !== undefined

const prepareServer = async ({
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
  // Merging internal with user-defined import maps.
  const importMapPaths = [...importMaps, config.functions['*'].deno_import_map]

  try {
    const bundler = await import('@netlify/edge-bundler')
    const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
    const runIsolate = await bundler.serve({
      ...getDownloadUpdateFunctions(),
      bootstrapURL: getBootstrapURL(),
      debug: env.NETLIFY_DENO_DEBUG === 'true',
      distImportMapPath,
      formatExportTypeError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(
          name,
        )}. The file does not seem to have a function as the default export.`,
      formatImportError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to run Edge Function ${chalk.yellow(name)}:`,
      importMapPaths,
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
