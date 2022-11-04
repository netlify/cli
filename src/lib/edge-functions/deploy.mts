// @ts-check
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'stat'.
const { stat } = require('fs').promises
// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'join'.
const { join } = require('path')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'getPathInP... Remove this comment to see the full error message
const { getPathInProject } = require('../settings.cjs')

// @ts-expect-error TS(2451): Cannot redeclare block-scoped variable 'EDGE_FUNCT... Remove this comment to see the full error message
const { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } = require('./consts.cjs')

const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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
// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
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

// @ts-expect-error TS(2304): Cannot find name '$TSFixMe'.
const isEdgeFunctionFile = (filePath: $TSFixMe) => filePath.startsWith(`${PUBLIC_URL_PATH}/`)

module.exports = {
  deployFileNormalizer,
  getDistPathIfExists,
  isEdgeFunctionFile,
}
