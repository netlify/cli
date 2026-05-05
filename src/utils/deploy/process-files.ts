import { stat } from 'fs/promises'
import { join } from 'path'

import { getPathInProject } from '../../lib/settings.js'
import { EDGE_FUNCTIONS_FOLDER, PUBLIC_URL_PATH } from '../../lib/edge-functions/consts.js'
import { File } from './file.js'

const DEPLOY_CONFIG_PATH = 'deploy-config'
const DB_MIGRATIONS_PUBLIC_URL_PATH = '.netlify/internal/db/migrations'

const deployConfigPathPath = getPathInProject([DEPLOY_CONFIG_PATH])
const edgeFunctionsDistPath = getPathInProject([EDGE_FUNCTIONS_FOLDER])
const dbMigrationsDistPath = getPathInProject(['internal', 'db', 'migrations'])

export const deployFileNormalizer = (workingDir: string, file: File) => {
  let { normalizedPath } = file

  switch (file.root) {
    case join(workingDir, edgeFunctionsDistPath):
      normalizedPath = `${PUBLIC_URL_PATH}/${file.normalizedPath}`

      break

    case join(workingDir, deployConfigPathPath):
      normalizedPath = `.netlify/${DEPLOY_CONFIG_PATH}/${file.normalizedPath}`

      break

    case join(workingDir, dbMigrationsDistPath):
      normalizedPath = `${DB_MIGRATIONS_PUBLIC_URL_PATH}/${file.normalizedPath}`

      break
  }

  return {
    ...file,
    normalizedPath,
  }
}

export const getDeployConfigPathIfExists = async (workingDir: string) =>
  getDirectoryIfExists(join(workingDir, deployConfigPathPath))

export const getEdgeFunctionsDistPathIfExists = async (workingDir: string) =>
  getDirectoryIfExists(join(workingDir, edgeFunctionsDistPath))

export const getDbMigrationsDistPathIfExists = async (workingDir: string) =>
  getDirectoryIfExists(join(workingDir, dbMigrationsDistPath))

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
