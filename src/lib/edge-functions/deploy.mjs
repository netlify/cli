// @ts-check
import { stat } from 'fs/promises'
import { join } from 'path'

import { getPathInProject } from '../settings.mjs'

import { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } from './consts.mjs'

const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])

/**
 * @param {string} workingDir
 * @param {*} file
 */
export const deployFileNormalizer = (workingDir, file) => {
  const absoluteDistPath = join(workingDir, distPath)
  const isEdgeFunction = file.root === absoluteDistPath
  const normalizedPath = isEdgeFunction ? `${PUBLIC_URL_PATH}/${file.normalizedPath}` : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

/**
 * @param {string} workingDir
 */
export const getDistPathIfExists = async (workingDir) => {
  try {
    const absoluteDistPath = join(workingDir, distPath)
    const stats = await stat(absoluteDistPath)

    if (!stats.isDirectory()) {
      throw new Error(`Path ${absoluteDistPath} must be a directory.`)
    }

    return absoluteDistPath
  } catch {
    // no-op
  }
}

export const isEdgeFunctionFile = (filePath) => filePath.startsWith(`${PUBLIC_URL_PATH}/`)
