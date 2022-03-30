// @ts-check
const { env } = require('process')

const getAvailablePort = require('get-port')
const fetch = require('node-fetch')
const pWaitFor = require('p-wait-for')
const { v4: generateUUID } = require('uuid')

const { getPathInProject } = require('../settings')
const { startSpinner, stopSpinner } = require('../spinner')

const { DIST_IMPORT_MAP_PATH, SERVER_POLL_INTERNAL, SERVER_POLL_TIMEOUT } = require('./consts')
const headers = require('./headers')
const { getInternalFunctions } = require('./internal')

const headersSymbol = Symbol('Edge Functions Headers')

const getDeclarations = (config, internalFunctions = []) => {
  const { edge_functions: userFunctions = [] } = config

  return [...internalFunctions, ...userFunctions]
}

const getDownloadUpdateFunctions = () => {
  let spinner

  const onAfterDownload = () => {
    stopSpinner({ spinner })
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

const initializeProxy = async ({ config, configWatcher, log, settings, warn }) => {
  const { functions: internalFunctions, importMap, path: internalFunctionsPath } = await getInternalFunctions()
  const { port: localPort } = settings
  const userFunctionsPath = config.build.edge_functions

  let manifest = {
    routes: [],
  }

  const port = await getAvailablePort()
  const server = startServerAndWatchForChanges({
    config,
    configWatcher,
    directories: [internalFunctionsPath, userFunctionsPath].filter(Boolean),
    importMaps: [importMap].filter(Boolean),
    internalFunctions,
    log,
    onManifestChange: (newManifest) => (manifest = newManifest),
    port,
    warn,
  })
  const hasEdgeFunctions = userFunctionsPath !== undefined || internalFunctions.length !== 0

  return async (req) => {
    if (req.headers[headers.Passthrough] !== undefined || !hasEdgeFunctions) {
      return
    }

    // Waiting for the Deno server to become available.
    await server

    const url = new URL(req.url, `http://127.0.0.1:${localPort}`)
    const routes = manifest.routes.map((route) => ({
      ...route,
      pattern: new RegExp(route.pattern),
    }))
    const matchingFunctions = routes.filter(({ pattern }) => pattern.test(url.pathname)).map((route) => route.function)

    if (matchingFunctions.length === 0) {
      return
    }

    req[headersSymbol] = {
      [headers.Functions]: matchingFunctions.join(','),
      [headers.Passthrough]: 'passthrough',
      [headers.RequestID]: generateUUID(),
      [headers.PassHost]: `127.0.0.1:${localPort}`,
    }

    return `http://127.0.0.1:${port}`
  }
}

const isEdgeFunctionsRequest = (req) => req[headersSymbol] !== undefined

const startServer = async ({ directories, importMaps = [], port, warn }) => {
  const { serve } = await import('@netlify-labs/edge-bundler')
  const distImportMapPath = getPathInProject([DIST_IMPORT_MAP_PATH])
  const { getManifest } = await serve(port, directories, {
    ...getDownloadUpdateFunctions(),
    debug: env.NETLIFY_DENO_DEBUG === 'true',
    distImportMapPath,
    importMaps,
  })
  const isDenoServerReady = async () => {
    try {
      await fetch(`http://127.0.0.1:${port}`)
    } catch {
      return false
    }

    return true
  }

  try {
    await pWaitFor(isDenoServerReady, {
      interval: SERVER_POLL_INTERNAL,
      timeout: SERVER_POLL_TIMEOUT,
    })
  } catch {
    warn('Could not initialize Edge Functions server. Execution of Edge Functions will be disabled.')
  }

  return { getManifest }
}

const startServerAndWatchForChanges = async ({
  config,
  configWatcher,
  directories,
  importMaps,
  internalFunctions,
  log,
  onManifestChange,
  port,
  warn,
}) => {
  const { getManifest } = await startServer({
    directories,
    importMaps,
    log,
    port,
    warn,
  })
  const declarations = getDeclarations(config, internalFunctions)
  const manifest = getManifest(declarations)

  onManifestChange(manifest)

  configWatcher.on('change', (newConfig) => {
    const newDeclarations = getDeclarations(newConfig, internalFunctions)
    const newManifest = getManifest(newDeclarations)

    onManifestChange(newManifest)
  })
}

module.exports = { handleProxyRequest, initializeProxy, isEdgeFunctionsRequest }
