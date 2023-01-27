// @ts-check
import { readFile, stat } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { cwd } from 'process'

import { getPathInProject } from '../settings.mjs'

import { INTERNAL_EDGE_FUNCTIONS_FOLDER } from './consts.mjs'

export const getInternalFunctions = async () => {
  const path = join(cwd(), getPathInProject([INTERNAL_EDGE_FUNCTIONS_FOLDER]))

  try {
    const stats = await stat(path)

    if (!stats.isDirectory()) {
      throw new Error('Internal edge functions directory expected')
    }
  } catch {
    return {
      functions: [],
      path: null,
    }
  }

  try {
    const manifestPath = join(path, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath))

    if (manifest.version !== 1) {
      throw new Error('Unsupported manifest format')
    }

    const data = {
      functions: manifest.functions || [],
      path,
    }

    if (manifest.import_map) {
      data.importMap = resolve(dirname(manifestPath), manifest.import_map)
    }

    return data
  } catch {
    return {
      functions: [],
      path,
    }
  }
}
