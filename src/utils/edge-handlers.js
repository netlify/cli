const path = require('path')
const ora = require('ora')
const logSymbols = require('log-symbols')
const { statAsync, readFileAsyncCatchError } = require('../lib/fs')
const uploadEdgeHandlersBundle = require('@netlify/plugin-edge-handlers/src/upload')

const MANIFEST_FILENAME = 'manifest.json'

const validateEdgeHandlerFolder = async ({ edgeHandlersFolder, error }) => {
  try {
    const resolvedFolder = path.resolve(process.cwd(), edgeHandlersFolder || '.netlify/edge-handlers')
    const stat = await statAsync(resolvedFolder)
    if (!stat.isDirectory()) {
      error(`Edge Handlers folder ${edgeHandlersFolder} must be a path to a directory`)
    }
    return resolvedFolder
  } catch (e) {
    // only error if edgeHandlers was passed as an argument
    if (edgeHandlersFolder) {
      if (e.code === 'ENOENT') {
        return error(`No such directory ${edgeHandlersFolder}!`)
      }
      // Improve the message of permission errors
      if (e.code === 'EACCES') {
        return error('Permission error when trying to access Edge Handlers folder')
      }
      throw e
    }
  }
}

const readBundleAndManifest = async ({ edgeHandlersResolvedFolder, error }) => {
  const manifestPath = path.resolve(edgeHandlersResolvedFolder, MANIFEST_FILENAME)
  const { content: manifest, error: manifestError } = await readFileAsyncCatchError(manifestPath)
  if (manifestError) {
    error(`Could not read Edge Handlers manifest file ${manifestPath}: ${manifestError.message}`)
  }

  let manifestJson
  try {
    manifestJson = JSON.parse(manifest)
  } catch (e) {
    error(`Edge Handlers manifest file is not a valid JSON file: ${e.message}`)
  }

  if (!manifestJson.sha) {
    error(`Edge Handlers manifest file is missing the 'sha' property`)
  }

  const bundlePath = path.resolve(edgeHandlersResolvedFolder, manifestJson.sha)
  const { content: bundle, error: bundleError } = await readFileAsyncCatchError(bundlePath)

  if (bundleError) {
    error(`Could not read Edge Handlers bundle file ${bundlePath}: ${bundleError.message}`)
  }

  return { bundle, manifest: manifestJson }
}

const deployEdgeHandlers = async ({ edgeHandlersFolder, deployId, apiToken, silent, error }) => {
  const edgeHandlersResolvedFolder = await validateEdgeHandlerFolder({ edgeHandlersFolder, error })
  if (edgeHandlersResolvedFolder) {
    try {
      const spinner = silent
        ? null
        : ora({
            text: `Deploying Edge Handlers from directory ${edgeHandlersResolvedFolder}`,
          }).start()

      const { bundle, manifest } = await readBundleAndManifest({ edgeHandlersResolvedFolder, error })
      // returns false if the bundle exists, true on success, throws on error
      const success = await uploadEdgeHandlersBundle(bundle, manifest, deployId, apiToken)
      if (!success) {
        spinner &&
          spinner.stopAndPersist({
            text: `Skipped deploying Edge Handlers since the bundle already exists`,
            symbol: logSymbols.success,
          })
      } else {
        spinner &&
          spinner.stopAndPersist({
            text: `Finished deploying Edge Handlers from directory: ${edgeHandlersResolvedFolder}`,
            symbol: logSymbols.success,
          })
      }
    } catch (e) {
      error(`Failed deploying Edge Handlers: ${e.message}`)
    }
  }
}

module.exports = { deployEdgeHandlers }
