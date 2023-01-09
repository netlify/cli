// @ts-check
import { stat } from 'fs/promises'
import { join } from 'path'

import { getPathInProject } from '../settings.mjs'

import { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } from './consts.mjs'

const distPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])

export const deployFileNormalizer = (rootDir, file) => {
  const absoluteDistPath = join(rootDir, distPath)
  const isEdgeFunction = file.root === absoluteDistPath
  const normalizedPath = isEdgeFunction ? `${PUBLIC_URL_PATH}/${file.normalizedPath}` : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

export const getDistPathIfExists = async ({ rootDir }) => {
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

export const isEdgeFunctionFile = (filePath) => filePath.startsWith(`${PUBLIC_URL_PATH}/`)
