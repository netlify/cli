// @ts-check
const path = require('path')

const { getPathInProject } = require('../settings')

const EDGE_HANDLERS_FOLDER = 'edge-handlers-dist'
const PUBLIC_URL_PATH = '.netlify/internal/edge-handlers'

const internalPath = getPathInProject([EDGE_HANDLERS_FOLDER])

const deployFileNormalizer = (file) => {
  const isEdgeHandler = file.root === internalPath
  const normalizedPath = isEdgeHandler ? path.join(PUBLIC_URL_PATH, file.normalizedPath) : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

const isEdgeHandlerFile = (filePath) => filePath.startsWith(`${PUBLIC_URL_PATH}${path.sep}`)

module.exports = { deployFileNormalizer, internalPath, isEdgeHandlerFile }
