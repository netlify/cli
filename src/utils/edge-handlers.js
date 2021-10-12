const path = require('path')

const { cancelDeploy, uploadEdgeHandlers } = require('../lib/api')
const { readFileAsyncCatchError, statAsync } = require('../lib/fs')
const { startSpinner, stopSpinner } = require('../lib/spinner')

const { error, warn } = require('./command-helpers')

const MANIFEST_FILENAME = 'manifest.json'
const EDGE_HANDLERS_FOLDER = '.netlify/edge-handlers'

const validateEdgeHandlerFolder = async ({ site }) => {
  try {
    const resolvedFolder = path.resolve(site.root, EDGE_HANDLERS_FOLDER)
    const stat = await statAsync(resolvedFolder)
    if (!stat.isDirectory()) {
      error(`Edge Handlers folder ${EDGE_HANDLERS_FOLDER} must be a path to a directory`)
    }
    return resolvedFolder
  } catch (error_) {
    // ignore errors at the moment
    // TODO: report error if 'edge_handlers' config exists after
    // https://github.com/netlify/build/pull/1829 is published
  }
}

const readBundleAndManifest = async ({ edgeHandlersResolvedFolder }) => {
  const manifestPath = path.resolve(edgeHandlersResolvedFolder, MANIFEST_FILENAME)
  const { content: manifest, error: manifestError } = await readFileAsyncCatchError(manifestPath)
  if (manifestError) {
    error(`Could not read Edge Handlers manifest file ${manifestPath}: ${manifestError.message}`)
  }

  let manifestJson
  try {
    manifestJson = JSON.parse(manifest)
  } catch (error_) {
    error(`Edge Handlers manifest file is not a valid JSON file: ${error_.message}`)
  }

  if (!manifestJson.sha) {
    error(`Edge Handlers manifest file is missing the 'sha' property`)
  }

  const bundlePath = path.resolve(edgeHandlersResolvedFolder, manifestJson.sha)
  const { content: bundleBuffer, error: bundleError } = await readFileAsyncCatchError(bundlePath)

  if (bundleError) {
    error(`Could not read Edge Handlers bundle file ${bundlePath}: ${bundleError.message}`)
  }

  return { bundleBuffer, manifest: manifestJson }
}

const deployEdgeHandlers = async ({ api, deployId, silent, site }) => {
  const edgeHandlersResolvedFolder = await validateEdgeHandlerFolder({ site })
  if (edgeHandlersResolvedFolder) {
    let spinner
    try {
      spinner = silent
        ? null
        : startSpinner({ text: `Deploying Edge Handlers from directory ${edgeHandlersResolvedFolder}` })

      const { bundleBuffer, manifest } = await readBundleAndManifest({ edgeHandlersResolvedFolder })
      // returns false if the bundle exists, true on success, throws on error
      const success = await uploadEdgeHandlers({
        api,
        deployId,
        bundleBuffer,
        manifest,
      })

      const text = success
        ? `Finished deploying Edge Handlers from directory: ${edgeHandlersResolvedFolder}`
        : `Skipped deploying Edge Handlers since the bundle already exists`
      stopSpinner({ spinner, text, error: false })
    } catch (error_) {
      const text = `Failed deploying Edge Handlers: ${error_.message}`
      stopSpinner({ spinner, text, error: true })
      await cancelDeploy({ api, deployId, warn })
      // no need to report the error again
      error('')
    }
  }
}

module.exports = { deployEdgeHandlers }
