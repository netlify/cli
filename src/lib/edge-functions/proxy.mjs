// @ts-check
import { Buffer } from 'buffer'
import { rm } from 'fs/promises'
import { join, relative, resolve } from 'path'

// eslint-disable-next-line import/no-namespace
import * as bundler from '@netlify/edge-bundler'
import getAvailablePort from 'get-port'

import { NETLIFYDEVERR, NETLIFYDEVWARN, chalk, error as printError, log } from '../../utils/command-helpers.mjs'
import { isFeatureFlagEnabled } from '../../utils/feature-flags.mjs'
import { getGeoLocation } from '../geo-location.mjs'
import { getPathInProject } from '../settings.mjs'
import { startSpinner, stopSpinner } from '../spinner.mjs'

import { getBootstrapURL } from './bootstrap.mjs'
import { DIST_IMPORT_MAP_PATH, EDGE_FUNCTIONS_SERVE_FOLDER } from './consts.mjs'
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

export const createAccountInfoHeader = (accountInfo = {}) => {
  const { id } = accountInfo
  const account = { id }
  const accountString = JSON.stringify(account)
  return Buffer.from(accountString).toString('base64')
}

/**
 *
 * @param {object} config
 * @param {*} config.accountId
 * @param {*} config.config
 * @param {*} config.configPath
 * @param {*} config.debug
 * @param {*} config.env
 * @param {*} config.geoCountry
 * @param {*} config.geolocationMode
 * @param {*} config.getUpdatedConfig
 * @param {*} config.inspectSettings
 * @param {*} config.mainPort
 * @param {boolean=} config.offline
 * @param {*} config.passthroughPort
 * @param {*} config.projectDir
 * @param {*} config.settings
 * @param {*} config.siteInfo
 * @param {*} config.state
 * @returns
 */
export const initializeProxy = async ({
  accountId,
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
  settings,
  siteInfo,
  state,
}) => {
  const {
    functions: internalFunctions,
    importMap,
    path: internalFunctionsPath,
  } = await getInternalFunctions(projectDir)
  const userFunctionsPath = config.build.edge_functions
  const isolatePort = await getAvailablePort()
  const buildFeatureFlags = {
    edge_functions_npm_modules: isFeatureFlagEnabled('edge_functions_npm_modules', siteInfo),
  }
  const runtimeFeatureFlags = ['edge_functions_bootstrap_failure_mode']

  // Initializes the server, bootstrapping the Deno CLI and downloading it from
  // the network if needed. We don't want to wait for that to be completed, or
  // the command will be left hanging.
  const server = prepareServer({
    config,
    configPath,
    debug,
    directory: userFunctionsPath,
    env: configEnv,
    featureFlags: buildFeatureFlags,
    getUpdatedConfig,
    importMaps: [importMap].filter(Boolean),
    inspectSettings,
    internalDirectory: internalFunctionsPath,
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
    req.headers[headers.Geo] = Buffer.from(JSON.stringify(geoLocation)).toString('base64')
    req.headers[headers.DeployID] = '0'
    req.headers[headers.Site] = createSiteInfoHeader(siteInfo)
    req.headers[headers.Account] = createAccountInfoHeader({ id: accountId })

    await registry.initialize()

    const url = new URL(req.url, `http://${LOCAL_HOST}:${mainPort}`)
    const { functionNames, invocationMetadata, orphanedDeclarations } = registry.matchURLPath(url.pathname, req.method)

    // If the request matches a config declaration for an Edge Function without
    // a matching function file, we warn the user.
    orphanedDeclarations.forEach((functionName) => {
      log(
        `${NETLIFYDEVWARN} Request to ${chalk.yellow(
          url.pathname,
        )} matches declaration for edge function ${chalk.yellow(
          functionName,
        )}, but there's no matching function file in ${chalk.yellow(
          relative(projectDir, userFunctionsPath),
        )}. Please visit ${chalk.blue('https://ntl.fyi/edge-create')} for more information.`,
      )
    })

    if (functionNames.length === 0) {
      return
    }

    req[headersSymbol] = {
      [headers.FeatureFlags]: getFeatureFlagsHeader(runtimeFeatureFlags),
      [headers.ForwardedProtocol]: settings.https ? 'https:' : 'http:',
      [headers.Functions]: functionNames.join(','),
      [headers.InvocationMetadata]: getInvocationMetadataHeader(invocationMetadata),
      [headers.IP]: LOCAL_HOST,
      [headers.Passthrough]: 'passthrough',
      [headers.PassthroughHost]: `localhost:${passthroughPort}`,
      [headers.PassthroughProtocol]: 'http:',
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
  debug,
  directory,
  env: configEnv,
  featureFlags,
  getUpdatedConfig,
  importMaps,
  inspectSettings,
  internalDirectory,
  internalFunctions,
  port,
  projectDir,
}) => {
  // Merging internal with user-defined import maps.
  const importMapPaths = [...importMaps, config.functions['*'].deno_import_map]

  try {
    const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
    const servePath = resolve(projectDir, getPathInProject([EDGE_FUNCTIONS_SERVE_FOLDER]))

    await rm(servePath, { force: true, recursive: true })

    const runIsolate = await bundler.serve({
      ...getDownloadUpdateFunctions(),
      basePath: projectDir,
      bootstrapURL: getBootstrapURL(),
      debug,
      distImportMapPath: join(projectDir, distImportMapPath),
      featureFlags,
      formatExportTypeError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to load Edge Function ${chalk.yellow(
          name,
        )}. The file does not seem to have a function as the default export.`,
      formatImportError: (name) =>
        `${NETLIFYDEVERR} ${chalk.red('Failed')} to run Edge Function ${chalk.yellow(name)}:`,
      importMapPaths,
      inspectSettings,
      port,
      servePath,
    })
    const registry = new EdgeFunctionsRegistry({
      bundler,
      config,
      configPath,
      debug,
      directories: [directory].filter(Boolean),
      env: configEnv,
      getUpdatedConfig,
      internalDirectories: [internalDirectory].filter(Boolean),
      internalFunctions,
      projectDir,
      runIsolate,
      servePath,
    })

    return registry
  } catch (error) {
    printError(error.message, { exit: false })
  }
}
