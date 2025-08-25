import { stat } from 'fs/promises'
import { join } from 'path'

import { getPathInProject } from './settings.js'

const DEPLOY_CONFIG_FOLDER = '.netlify/deploy-config'

const distPath = getPathInProject([DEPLOY_CONFIG_FOLDER])

export const getDeployConfigPathIfExists = async (workingDir: string) => {
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
