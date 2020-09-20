const path = require('path')
const { statAsync, readFileAsyncCatchError } = require('../lib/fs')
const { uploadEdgeHandlers } = require('../lib/api')
const { startSpinner, stopSpinner } = require('../lib/spinner')

const MANIFEST_FILENAME = 'manifest.json'

const validateEdgeHandlerFolder = async ({ site, edgeHandlersFolder, error }) => {
  try {
    const resolvedFolder = path.resolve(site.root, edgeHandlersFolder || '.netlify/edge-handlers')
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
  const { content: bundleBuffer, error: bundleError } = await readFileAsyncCatchError(bundlePath)

  if (bundleError) {
    error(`Could not read Edge Handlers bundle file ${bundlePath}: ${bundleError.message}`)
  }

  return { bundleBuffer, manifest: manifestJson }
}

const deployEdgeHandlers = async ({ site, edgeHandlersFolder, deployId, api, silent, error, warn }) => {
  const edgeHandlersResolvedFolder = await validateEdgeHandlerFolder({ site, edgeHandlersFolder, error })
  if (edgeHandlersResolvedFolder) {
    let spinner
    try {
      spinner = silent
        ? null
        : startSpinner({ text: `Deploying Edge Handlers from directory ${edgeHandlersResolvedFolder}` })

      const { bundleBuffer, manifest } = await readBundleAndManifest({ edgeHandlersResolvedFolder, error })
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
    } catch (e) {
      const text = `Failed deploying Edge Handlers: ${e.message}`
      stopSpinner({ spinner, text, error: true })
      try {
        await api.cancelSiteDeploy({ deploy_id: deployId })
      } catch (e) {
        warn(`Failed canceling deploy with id ${deployId}: ${e.message}`)
      }
      // no need to report the error again
      error('')
    }
  }
}

module.exports = { deployEdgeHandlers }
