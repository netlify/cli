// @ts-check
const { stat } = require('fs').promises
const path = require('path')

const { getPathInProject } = require('../settings')

const { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } = require('./consts')

const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])

const deployFileNormalizer = (file) => {
  const isEdgeFunction = file.root === distPath
  const normalizedPath = isEdgeFunction ? path.join(PUBLIC_URL_PATH, file.normalizedPath) : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

const getDistPathIfExists = async () => {
  try {
    const stats = await stat(distPath)

    if (!stats.isDirectory()) {
      throw new Error(`Path ${distPath} must be a directory.`)
    }

    return distPath
  } catch {
    // no-op
  }
}

const isEdgeFunctionFile = (filePath) => filePath.startsWith(`${PUBLIC_URL_PATH}${path.sep}`)

module.exports = {
  deployFileNormalizer,
  getDistPathIfExists,
  isEdgeFunctionFile,
}
