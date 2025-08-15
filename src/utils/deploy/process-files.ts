import { stat } from 'fs/promises'
import { join } from 'path'

import { getPathInProject } from '../../lib/settings.js'
import { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } from '../../lib/edge-functions/consts.js'
import { File } from './file.js'

const DEPLOY_CONFIG_PATH = '.netlify/deploy-config'

const deployConfigPathPath = getPathInProject([DEPLOY_CONFIG_PATH])
const edgeFunctionsDistPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])

export const deployFileNormalizer = (workingDir: string, file: File) => {
  const absoluteDistPath = join(workingDir, edgeFunctionsDistPath)
  const isEdgeFunction = file.root === absoluteDistPath
  const normalizedPath = isEdgeFunction ? `${PUBLIC_URL_PATH}/${file.normalizedPath}` : file.normalizedPath

  return {
    ...file,
    normalizedPath,
  }
}

export const getDeployConfigPathIfExists = async (workingDir: string) =>
  getDirectoryIfExists(join(workingDir, deployConfigPathPath))

export const getEdgeFunctionsDistPathIfExists = async (workingDir: string) =>
  getDirectoryIfExists(join(workingDir, edgeFunctionsDistPath))

const getDirectoryIfExists = async (directoryPath: string) => {
  try {
    const stats = await stat(directoryPath)

    if (!stats.isDirectory()) {
      throw new Error(`Path ${directoryPath} must be a directory.`)
    }

    return directoryPath
  } catch {
    // no-op
  }
}

export const isEdgeFunctionFile = (filePath: string) => filePath.startsWith(`${PUBLIC_URL_PATH}/`)
