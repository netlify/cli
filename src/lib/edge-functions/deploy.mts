// @ts-check

const { stat } = require('fs').promises

const { join } = require('path')


const { getPathInProject } = require('../settings.mjs')


const { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } = require('./consts.mjs')

const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])


const deployFileNormalizer = (rootDir: $TSFixMe, file: $TSFixMe) => {
  const absoluteDistPath = join(rootDir, distPath)
  const isEdgeFunction = file.root === absoluteDistPath
  const normalizedPath = isEdgeFunction ? `${PUBLIC_URL_PATH}/${file.normalizedPath}` : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

const getDistPathIfExists = async ({
  rootDir

}: $TSFixMe) => {
  try {
    const absoluteDistPath = join(rootDir, distPath)
    const stats = await stat(absoluteDistPath)

    if (!stats.isDirectory()) {
      throw new Error(`Path ${absoluteDistPath} must be a directory.`)
    }

    return absoluteDistPath
  } catch {
    // no-op
  }
}


const isEdgeFunctionFile = (filePath: $TSFixMe) => filePath.startsWith(`${PUBLIC_URL_PATH}/`)

export default {
  deployFileNormalizer,
  getDistPathIfExists,
  isEdgeFunctionFile,
}
